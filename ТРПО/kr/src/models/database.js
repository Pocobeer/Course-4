const sqlite = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        const dbPath = path.join(__dirname, '../../database/rental.db');

        this.db = new sqlite.Database(dbPath, (err) => {
            if (err) {
                console.error(err);
            } else {
                console.log('Connected to the database');
                this.enableForeignKeys();
            }
        });
    }

    enableForeignKeys() {
        this.db.run('PRAGMA foreign_keys = ON');
    }
    initializeDatabase() {
        const schemsPath = path.join(__dirname, '../../database/schema.sql');
        const schema = fs.readFileSync(schemsPath, 'utf-8');
        this.db.exec(schema, (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Database initialized');
            }
        });
    }

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: this.lastID,
                        changes: this.changes,
                    });
                }
            });
        });
    }

    transaction(callback) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                callback(this)
                    .then(() => {
                        this.db.run('COMMIT', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    })
                    .catch((err) => {
                        this.db.run('ROLLBACK');
                        reject(err);
                    });
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = new Database();
