const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "gallery.db");
const db = new sqlite3.Database(dbPath);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("MediaVault backend is running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      type TEXT NOT NULL,
      visibility TEXT NOT NULL,
      owner TEXT NOT NULL,
      uploadDate TEXT NOT NULL,
      status TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      fileUrl TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(
    `INSERT OR IGNORE INTO users (id, username, email, password)
     VALUES (?, ?, ?, ?)`,
    ["u1", "demoUser", "demo@mediavault.com", "123456"]
  );
});

// REGISTER
app.post("/register", (req, res) => {
  const { id, username, email, password } = req.body;

  if (!id || !username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  db.run(
    `INSERT INTO users (id, username, email, password)
     VALUES (?, ?, ?, ?)`,
    [id, username, email, password],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(409).json({ error: "Email already registered" });
        }
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        message: "Account created successfully",
        user: { id, username, email }
      });
    }
  );
});

// LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  db.get(
    `SELECT id, username, email FROM users WHERE email = ? AND password = ?`,
    [email, password],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!user) {
        return res.status(401).json({ error: "Incorrect email or password" });
      }

      res.json({
        message: "Login successful",
        user
      });
    }
  );
});

// GET ALL MEDIA
app.get("/media", (req, res) => {
  db.all("SELECT * FROM media ORDER BY uploadDate DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const data = rows.map(r => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : []
    }));

    res.json(data);
  });
});

// GET SINGLE MEDIA
app.get("/media/:id", (req, res) => {
  db.get("SELECT * FROM media WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Not found" });

    row.tags = row.tags ? JSON.parse(row.tags) : [];
    res.json(row);
  });
});

// CREATE MEDIA
app.post("/media", (req, res) => {
  const {
    id,
    title,
    description,
    tags,
    type,
    visibility,
    owner,
    uploadDate,
    status,
    views,
    fileUrl
  } = req.body;

  if (!id || !title || !type || !visibility || !owner || !uploadDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.run(
    `INSERT INTO media (id, title, description, tags, type, visibility, owner, uploadDate, status, views, fileUrl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      title,
      description || "",
      JSON.stringify(tags || []),
      type,
      visibility,
      owner,
      uploadDate,
      status || "Uploaded",
      views || 0,
      fileUrl || null
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.status(201).json({
        message: "Created",
        id
      });
    }
  );
});

// UPDATE MEDIA
app.put("/media/:id", (req, res) => {
  const { title, description, tags, visibility } = req.body;

  if (!title || !visibility) {
    return res.status(400).json({ error: "Title and visibility are required" });
  }

  db.run(
    `UPDATE media
     SET title = ?, description = ?, tags = ?, visibility = ?
     WHERE id = ?`,
    [
      title,
      description || "",
      JSON.stringify(tags || []),
      visibility,
      req.params.id
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Not found" });

      res.json({ message: "Updated" });
    }
  );
});

// DELETE MEDIA
app.delete("/media/:id", (req, res) => {
  db.run("DELETE FROM media WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Not found" });

    res.json({ message: "Deleted" });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});