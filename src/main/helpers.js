import { net } from "electron";
import { spawn } from 'child_process'
import crypto from 'crypto'

/**
 * Generates a secure random password.
 * @param {number} length - The desired length of the password.
 */
export function generateSecurePassword(length = 16) {
  // Define available characters
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
  let password = '';
  
  // Create an array of random bytes
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    // Map each random byte to a character in our charset
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
}

export function makeRequest(url, method, token = null, body = null) {
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

export async function runCommand(cmd, args, options={}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, options);

    let output = '';
    let errorOutput = '';
    let stdoutBuffer = '';
    let stderrBuffer = '';

    child.stdout.on('data', (data) => {
      const dataSting = data.toString();
      console.log(dataSting)
      output += dataSting

      stdoutBuffer += dataSting
      let lines = stdoutBuffer.split(/[\r\n]+/)

      stdoutBuffer = lines.pop()

      if (options.stdoutCallback) {
        for (const line of lines) {
          try {
            options.stdoutCallback(line, child, resolve, reject)
          } catch (error) {
            child.kill()
            reject(new Error(`${error}\n${errorOutput}`))
          }
        }
      }
    });

    child.stderr.on('data', (data) => {
      const dataSting = data.toString();
      errorOutput += dataSting

      stderrBuffer += dataSting
      let lines = stderrBuffer.split(/[\r\n]+/)

      stderrBuffer = lines.pop()

      if (options.stderrCallback) {
        for (let line of lines) {
          try {
            options.stderrCallback(line, child, resolve, reject)
          } catch (error) {
            child.kill()
            reject(new Error(`${error}\n${errorOutput}`))
          }
        }
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Process failed with code ${code}: ${errorOutput}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

export async function sleep(ms) {
  return new Promise(res => setTimeout(res, ms))
}