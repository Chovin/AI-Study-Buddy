import sqlite3 from 'sqlite3';
import { join } from 'path';
import { app } from 'electron';
import fs from 'fs';


class File {
  constructor(db, row) {
    this.db = db;       // reference to your Database instance
    this.id = row.id;
    this.topic_id = row.topic_id
    this.webui_id = row.webui_id;
    this.file_name = row.file_name;
    this.file_path = row.file_path;
    this.processed = row.processed;       // 1 = ready, 0 = waiting, -1 = errored
    this.processing_error = row.processing_error;
  }

  // Status helpers
  isProcessed() {
    return this.processed === Database.FILE_PROCESSED_READY;
  }

  hasErrored() {
    return this.processed === Database.FILE_PROCESSED_ERRORED;
  }

  isPending() {
    return this.processed === Database.FILE_PROCESSED_WAITING;
  }

  async delete() {
    await this.db.deleteFile(this.id)
    return null
  }

  async updatePath(path) {
    await this.db.updateFilePath(this.id, path)
    this.file_path = path
    return this
  }

  async setWebUIID(webuiId) {
    await this.db.updateFile(this.id, webuiId)
    this.webui_id = webuiId
    return this
  }

  // Markers
  async markReady() {
    await this.db.updateFileIsProcessed(this.id, Database.FILE_PROCESSED_READY);
    this.processed = Database.FILE_PROCESSED_READY;
    this.processing_error = null;
    return this;
  }

  async markErrored(errorMessage) {
    await this.db.runAsync(
      `UPDATE files SET processed = ?, processing_error = ? WHERE id = ?`,
      [Database.FILE_PROCESSED_ERRORED, errorMessage, this.id]
    );
    this.processed = Database.FILE_PROCESSED_ERRORED;
    this.processing_error = errorMessage;
    return this;
  }

  async markPending() {
    await this.db.updateFileIsProcessed(this.id, Database.FILE_PROCESSED_WAITING);
    this.processed = Database.FILE_PROCESSED_WAITING;
    this.processing_error = null;
    return this;
  }

  canRetry() {
    if (!this.hasErrored()) return false;
    const retryableErrors = ['timeout', 'network', 'temporarily unavailable', 'soffice command was not found'];
    return retryableErrors.some(err => this.processing_error?.toLowerCase().includes(err));
  }
}


class Database {
  static FILE_PROCESSED_READY = 1
  static FILE_PROCESSED_WAITING = 0
  static FILE_PROCESSED_ERRORED = -1

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
        webui_id TEXT,
        processed INTEGER NOT NULL DEFAULT 0,
        processing_error TEXT,
        FOREIGN KEY (topic_id) REFERENCES topics (id)
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        encrypted_api_key TEXT NOT NULL
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        files_referenced TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topic_id) REFERENCES topics (id)
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    return await this.getFile(result.lastID)
  }

  async updateFile(fileId, webui_id) {
    const query = `
      UPDATE files
      SET webui_id = ?
      WHERE id = ?
    `;
    const result = await this.runAsync(query, [webui_id, fileId])
    if (result.changes === 0) {
      // verify existence
      if (!await this.fileExists(fileId)) {
        throw new Error(`File with id ${fileId} not found`)
      }
    }
  }

  async getFile(fileId) {
    const query = `
      SELECT *
      FROM files
      WHERE id = ?
    `
    const rows = await this.allAsync(query, [fileId])
    if (rows.length === 0) throw new Error(`File with id ${fileId} not found`)
    return new File(this, rows[0])
  }

  async fileExists(fileId) {
    try {
      await this.getFile(fileId)
    } catch (err) {
      if (err.message?.includes('not found')) {
        return false
      }
      throw err
    }
    return true
  }

  async updateFileIsProcessed(fileId, state) {
    if (![
      Database.FILE_PROCESSED_ERRORED,
      Database.FILE_PROCESSED_READY,
      Database.FILE_PROCESSED_WAITING
    ].includes(state)) {
      throw new Error(`Invalid state: ${state}`)
    }
    let query = `
      UPDATE files
      SET processed = ?
      WHERE id = ?
    `
    if (state != Database.FILE_PROCESSED_ERRORED) {
      query = `
        UPDATE files
        SET processed = ?,
        processing_error = null
        WHERE id = ?
      `
    }
    const result = await this.runAsync(query, [state, fileId])
    if (result.changes === 0) {
      // verify existence
      if (!await this.fileExists(fileId)) {
        throw new Error(`File with id ${fileId} not found`)
      }
    }
  }

  async getPendingFiles() {
    return (await this.allAsync(`
      SELECT * FROM files WHERE webui_id IS NULL or processed != ?
    `, [Database.FILE_PROCESSED_READY])).map(row => new File(this, row));
  }

  async deleteFile(fileId) {
    const query = `
      DELETE FROM files WHERE id = ?`;
    await this.runAsync(query, [fileId]);
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
    return (await this.allAsync(query, [topicId])).map(row => new File(this, row));
  }

  async updateTopic(topicId, newName) {
    const query = `UPDATE topics SET name = ? WHERE id = ?`;
    await this.runAsync(query, [newName, topicId]);
  }

  async deleteTopic(topicId) {
    const deleteFilesQuery = `DELETE FROM files WHERE topic_id = ?`;
    const deleteTopicQuery = `DELETE FROM topics WHERE id = ?`;

    await this.runAsync(deleteFilesQuery, [topicId]);
    await this.runAsync(deleteTopicQuery, [topicId]);
  }

  async saveUser(email, password, encryptedApiKey) {
    const query = `INSERT INTO users (email, password, encrypted_api_key) VALUES (?, ?, ?)`;
    await this.runAsync(query, [email, password, encryptedApiKey]);
  }

  async getUserByEmail(email) {
    const query = `SELECT * FROM users WHERE email = ?`;
    const users = await this.allAsync(query, [email]);
    return users[0]; // Return the first user found (should be unique)
  }

  async saveChatMessage(topicId, role, content, filesReferenced = null) {
    const query = `
      INSERT INTO chat_history (topic_id, role, content, files_referenced, timestamp)
      VALUES (?, ?, ?, ?, datetime('now'))
    `;
    const filesJson = filesReferenced ? JSON.stringify(filesReferenced) : null;
    return await this.runAsync(query, [topicId, role, content, filesJson]);
  }

  async getRecentSummary(topicId) {
    const query = `
      SELECT id, topic_id, content, timestamp
      FROM summaries
      WHERE topic_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const results = await this.allAsync(query, [topicId]);
    return results[0] || null;
  }

  async saveSummary(topicId, content) {
    const query = `
      INSERT INTO summaries (topic_id, content, timestamp)
      VALUES (?, ?, datetime('now'))
    `;
    return await this.runAsync(query, [topicId, content]);
  }

  async getChatHistoryAfterTimestamp(topicId, timestamp) {
    const query = `
      SELECT id, topic_id, role, content, timestamp
      FROM chat_history
      WHERE topic_id = ? AND timestamp > ?
      ORDER BY timestamp ASC
    `;
    return await this.allAsync(query, [topicId, timestamp]);
  }

  async getChatHistoryPageBeforeId(topicId, beforeId, pageSize) {
    console.log(`Fetching chat history for topic ${topicId} before message ID ${beforeId} with page size ${pageSize}`)
    if (beforeId === null) {
      console.log('Fetching most recent messages since beforeId is null')
      // If beforeId is null, return the most recent messages
      const query = `
        SELECT id, topic_id, role, content, files_referenced, timestamp
        FROM chat_history
        WHERE topic_id = ?
        ORDER BY id DESC
        LIMIT ?
      `;
      const results = await this.allAsync(query, [topicId, pageSize]);
      return results.reverse(); // reverse to return in chronological order
    }

    const query = `
      SELECT id, topic_id, role, content, files_referenced, timestamp
      FROM chat_history
      WHERE topic_id = ? AND id < ?
      ORDER BY id DESC
      LIMIT ?
    `;
    const results = await this.allAsync(query, [topicId, beforeId, pageSize]);
    return results.reverse(); // reverse to return in chronological order
  }

  async saveGeneratedContent(topicId, role, content, filesReferenced = null) {
    // Generic method to save quizzes, flashcards, and content summaries
    // role should be one of: 'quiz', 'flashcard', 'content_summary'
    return await this.saveChatMessage(topicId, role, content, filesReferenced);
  }

  async getContentByRole(topicId, role, limit = 10) {
    const query = `
      SELECT id, topic_id, role, content, files_referenced, timestamp
      FROM chat_history
      WHERE topic_id = ? AND role = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    return await this.allAsync(query, [topicId, role, limit]);
  }

  async getAllChatHistory(topicId) {
    const query = `
      SELECT id, topic_id, role, content, files_referenced, timestamp
      FROM chat_history
      WHERE topic_id = ?
      ORDER BY timestamp ASC
    `;
    return await this.allAsync(query, [topicId]);
  }
}


export default Database;