const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد قاعدة البيانات
const db = new Database(path.join(__dirname, 'database.db'));

// جدول المتابعين
db.exec(`
  CREATE TABLE IF NOT EXISTS followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// جدول إحصائيات عامة (اختياري: عدد المتابعين الافتراضي)
db.exec(`
  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER DEFAULT 0
  );
`);
db.prepare(`INSERT OR IGNORE INTO stats (key, value) VALUES ('base_followers', 0)`).run();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// جلب عدد المتابعين
app.get('/api/followers/count', (req, res) => {
  const realCount = db.prepare('SELECT COUNT(*) AS c FROM followers').get().c;
  const baseCount = db.prepare(`SELECT value FROM stats WHERE key = 'base_followers'`).get().value;
  res.json({ count: baseCount + realCount });
});

// التحقق إذا كان المستخدم متابع
app.get('/api/followers/check/:userId', (req, res) => {
  const { userId } = req.params;
  const row = db.prepare('SELECT id FROM followers WHERE user_id = ?').get(userId);
  res.json({ following: !!row });
});

// متابعة
app.post('/api/followers/follow', (req, res) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string' || userId.length < 5) {
    return res.status(400).json({ error: 'userId غير صالح' });
  }
  try {
    const stmt = db.prepare('INSERT OR IGNORE INTO followers (user_id) VALUES (?)');
    const info = stmt.run(userId);
    const realCount = db.prepare('SELECT COUNT(*) AS c FROM followers').get().c;
    const baseCount = db.prepare(`SELECT value FROM stats WHERE key = 'base_followers'`).get().value;
    res.json({
      following: true,
      added: info.changes > 0,
      count: baseCount + realCount
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// إلغاء المتابعة
app.post('/api/followers/unfollow', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId مطلوب' });
  try {
    db.prepare('DELETE FROM followers WHERE user_id = ?').run(userId);
    const realCount = db.prepare('SELECT COUNT(*) AS c FROM followers').get().c;
    const baseCount = db.prepare(`SELECT value FROM stats WHERE key = 'base_followers'`).get().value;
    res.json({ following: false, count: baseCount + realCount });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ MEDO GAMING server يعمل على http://localhost:${PORT}`);
});