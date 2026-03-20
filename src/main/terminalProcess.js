const { spawn } = require('child_process');

export async function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(cmd, args);

    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Process failed with code ${code}: ${errorOutput}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}