import fs from 'fs';
import path from 'path';
import { app } from 'electron';

app.setName('ai-study-buddy');

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  const dbPaths = [['resources', 'app.db'], ['webui.db']]; // replace with your actual DB filenames

  dbPaths.forEach((p) => {
    const filePath = path.join(userData, ...p);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted ${filePath}`);
    } else {
      console.log(`File not found: ${filePath}`);
    }
  });

  console.log('Database cleanup complete.');
  app.quit();
});