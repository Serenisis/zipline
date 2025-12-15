const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("zipline.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Database connected");
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    photo TEXT
  )
`);

module.exports = db;

db.run(`
  CREATE TABLE IF NOT EXISTS likes (
    from_user TEXT,
    to_user TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS matches (
    user1 TEXT,
    user2 TEXT
  )
`);

db.run(`
CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  liker_id INTEGER,
  liked_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER,
  user2_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER,
  receiver_id INTEGER,
  text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);