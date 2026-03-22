import fs from 'fs';
import path from 'path';
import { app } from 'electron';

app.setName('ai-study-buddy');

// folders/files to preserve
const SKIP = [
  'electron-ollama',  // ollama server
  'webui',  // python venv and open webui package
];

app.whenReady().then(() => {
  const userData = app.getPath('userData');

  const entries = fs.readdirSync(userData);

  entries.forEach((entry) => {
    if (SKIP.includes(entry)) return; // skip any entry in the SKIP list

    const fullPath = path.join(userData, entry);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`Deleted folder: ${fullPath}`);
      } else {
        fs.unlinkSync(fullPath);
        console.log(`Deleted file: ${fullPath}`);
      }
    } catch (err) {
      console.error(`Failed to delete ${fullPath}:`, err);
    }
  });

  console.log('Cleanup complete (skipped items:', SKIP.join(', '), ').');
  app.quit();
});