import sqlite3 from 'sqlite3';
import { join } from 'path';
import { app } from 'electron';
import fs from 'fs';


class Database {
  constructor() {
    const userDataPath = app.getPath('userData');
    const folderPath = join(userDataPath, 'resources');
    fs.mkdirSync(folderPath, { recursive: true })
    const dbPath = join(folderPath, 'app.db');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) console.error('Failed to connect to database:', err);
      else console.log('Connected to SQLite database');
    });

    this.initialize();
  }

  initialize() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        FOREIGN KEY (topic_id) REFERENCES topics (id)
      )
    `);
  }

  // Helper to promisify database operations
  runAsync(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this); // 'this' contains metadata like lastID
      });
    });
  }

  allAsync(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  
  async createTopic(name) {
    const query = `INSERT INTO topics (name) VALUES (?)`;
    await this.runAsync(query, [name]);
  }

  async addFile(topicId, originalFileName) {
    const query = `
      INSERT INTO files (topic_id, file_name, file_path)
      VALUES (?, ?, ?)
    `;
    const result = await this.runAsync(query, [topicId, originalFileName, '']);
    return result.lastID; // Return the file_id
  }

  async updateFilePath(fileId, filePath) {
    const query = `UPDATE files SET file_path = ? WHERE id = ?`;
    await this.runAsync(query, [filePath, fileId]);
  }

  async getTopics() {
    const query = `SELECT * FROM topics`;
    return await this.allAsync(query);
  }

  async getFilesByTopic(topicId) {
    const query = `SELECT * FROM files WHERE topic_id = ?`;
    return await this.allAsync(query, [topicId]);
  }
}

export default Database;