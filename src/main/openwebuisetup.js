const { app, ipcMain, net, safeStorage } = require('electron');
const { spawn } = require('child_process');
const { exec } = require('child_process');


const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api/v1';
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';
const INSTALL_CMD = `${PYTHON_CMD} -m pip install open-webui`;

ipcMain.handle('automate-setup', async (event, { email, password, name }) => {
  try {
    // 1. SIGNUP: Create the user account
    await makeRequest(`${BASE_URL}/auths/signup`, 'POST', null, { email, password, name });

    // 2. SIGNIN: Get a temporary JWT to authorize the key generation
    const loginData = await makeRequest(`${BASE_URL}/auths/signin`, 'POST', null, { email, password });
    const jwt = loginData.token;

    // 3. GENERATE KEY: Use the JWT to create the permanent 'sk-' API Key
    // Note: The endpoint for creating a key is usually a POST to /auths/api_key
    const keyData = await makeRequest(`${BASE_URL}/auths/api_key`, 'POST', jwt);
    const apiKey = keyData.api_key; 

    // 4. SECURE: Encrypt and return the key to be saved locally
    const encryptedKey = safeStorage.encryptString(apiKey);
    app.db.saveUser(email, password, encryptedKey); // Save to DB for later retrieval
    
    return { success: true, apiKey: apiKey }; // Or return encryptedKey to store in a file
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Helper to handle Electron's native 'net' requests
 */
function makeRequest(url, method, token = null, body = null) {
  return new Promise((resolve, reject) => {
    const request = net.request({ method, url });
    
    request.setHeader('Content-Type', 'application/json');
    if (token) request.setHeader('Authorization', `Bearer ${token}`);

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        const json = data ? JSON.parse(data) : {};
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(json);
        } else {
          reject(new Error(json.detail || `Request failed: ${response.statusCode}`));
        }
      });
    });

    if (body) request.write(JSON.stringify(body));
    request.end();
  });
}

ipcMain.handle('send-ai-prompt', async (event, prompt) => {
  try {
    // 1. Read the encrypted buffer from disk
    const encryptedBuffer = await app.db.getUserByEmail().encrypted_api_key

    // 2. Decrypt it back to a plain string
    const plainApiKey = safeStorage.decryptString(encryptedBuffer);

    // 3. Use the PLAIN string in the Authorization header
    const response = await makeChatRequest(plainApiKey, prompt);
    return response;
  } catch (error) {
    console.error('Decryption or Request failed:', error);
    return { error: 'Failed to authenticate' };
  }
});

function makeChatRequest(apiKey, model, prompt) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: 'http://localhost:3000/api/chat/completions', // OpenAI-compatible endpoint
    });

    request.setHeader('Authorization', `Bearer ${apiKey}`);
    request.setHeader('Content-Type', 'application/json');

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve(JSON.parse(data)));
    });

    request.write(JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }]
    }));
    request.end();
  });
}

function startOpenWebUI() {
  // Define the data directory to ensure persistent storage

  const env = {
    ...process.env,
    DATA_DIR: app.getPath('userData'),
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434', // Link to local Ollama
    WEBUI_AUTH: 'True', // Enable authentication for the JWT/API key flow discussed earlier
    DEFAULT_USER_ROLE: 'admin' // Auto-approve the first user as admin
  };

  // Execute the 'open-webui serve' command
  const webuiProcess = spawn('open-webui', ['serve'], { env, shell: true });

  webuiProcess.stdout.on('data', (data) => {
    console.log(`WebUI: ${data}`);
    if (data.toString().includes('Uvicorn running on')) {
      console.log("Open WebUI is ready!");
      // Now you can safely start the automated signup/login flow
    }
  });

  webuiProcess.stderr.on('data', (data) => {
    console.error(`WebUI Error: ${data}`);
  });

  return webuiProcess;
}

function installOpenWebUI() {
  // 1. First, verify python3 is installed
  exec(`${PYTHON_CMD} --version`, (error) => {
    if (error) {
      console.error("Python 3 not found. Please install Python 3.11+ first.");
      return;
    }
    
    console.log("Starting Open WebUI installation...");
    const process = exec(INSTALL_CMD);

    process.stdout.on('data', (data) => console.log(`stdout: ${data}`));
    process.stderr.on('data', (data) => console.error(`stderr: ${data}`));

    process.on('close', (code) => {
      if (code === 0) {
        console.log("Installation successful!");
      } else {
        console.error(`Installation failed with code ${code}`);
      }
    });
  });
}

async function _uploadFile(apiKey, filePath) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/files/' // Open WebUI file upload endpoint
    });

    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    request.setHeader('Authorization', `Bearer ${apiKey}`);
    request.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`);

    // Construct multipart form data
    const filename = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    
    let payload = `--${boundary}\r\n`;
    payload += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
    payload += `Content-Type: application/octet-stream\r\n\r\n`;

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve(JSON.parse(data)));
    });

    request.write(payload);
    request.write(fileContent);
    request.write(`\r\n--${boundary}--\r\n`);
    request.end();
  });
}

async function registerFile(filePath) {
  file = await _uploadFile(app.apiKey, filePath);
  
}

async function chatWithFile(apiKey, fileIds, model, userPrompt) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: 'http://localhost:3000/api/chat/completions'
    });

    request.setHeader('Authorization', `Bearer ${apiKey}`);
    request.setHeader('Content-Type', 'application/json');

    const body = {
      model,
      messages: [{ role: 'user', content: userPrompt }],
      // THIS IS THE KEY: Tell Open WebUI which files to "look at"
      files: fileIds.map((f) => {
        return {
          type: 'file',
          id: f.webui_id // The ID returned from the upload step
        }
      })
    };

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve(JSON.parse(data)));
    });

    request.write(JSON.stringify(body));
    request.end();
  });
}