const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const db = new sqlite3.Database("./gallery.db");

app.use(cors());
app.use(express.json());

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
});

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

app.get("/media/:id", (req, res) => {
  db.get("SELECT * FROM media WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Not found" });
    row.tags = row.tags ? JSON.parse(row.tags) : [];
    res.json(row);
  });
});

app.post("/media", (req, res) => {
  const {
    id, title, description, tags, type, visibility,
    owner, uploadDate, status, views, fileUrl
  } = req.body;

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
      res.status(201).json({ message: "Created", id });
    }
  );
});

app.put("/media/:id", (req, res) => {
  const { title, description, tags, visibility } = req.body;

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

app.delete("/media/:id", (req, res) => {
  db.run("DELETE FROM media WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});