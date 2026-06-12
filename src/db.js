const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'db.db');

function loadDB() {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ bots: {}, sessions: {}, logs: [], settings: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function set(key, value) {
  const db = loadDB();
  db[key] = value;
  saveDB(db);
}
 
function get(key) {
  const db = loadDB();
  return db[key];
}

module.exports = { loadDB, saveDB, set, get };
