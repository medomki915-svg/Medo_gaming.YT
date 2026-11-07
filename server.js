const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد الاتصال بقاعدة البيانات
// Render هيقرا الرابط ده من الإعدادات اللي هنحطها بعدين
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// إنشاء الجدول لو مش موجود
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS followers (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stats (
        key VARCHAR(50) PRIMARY KEY,
        value INTEGER DEFAULT 0
      );
    `);
    await pool.query(`
      INSERT INTO stats (key, value) VALUES ('base_followers', 0)
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }
}
initDB();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// جلب عدد المتابعين
app.get('/api/followers/count', async (req, res) => {
  try {
    const realCountRes = await pool.query('SELECT COUNT(*) AS c FROM followers');
    const baseCountRes = await pool.query(`SELECT value FROM stats WHERE key = 'base_followers'`);
    const realCount = parseInt(realCountRes.rows[0].c);
    const baseCount = baseCountRes.rows[0] ? parseInt(baseCountRes.rows[0].value) : 0;
    res.json({ count: baseCount + realCount });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// التحقق إذا كان المستخدم متابع
app.get('/api/followers/check/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT id FROM followers WHERE user_id = $1', [userId]);
    res.json({ following: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// متابعة
app.post('/api/followers/follow', async (req, res) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string' || userId.length < 5) {
    return res.status(400).json({ error: 'userId غير صالح' });
  }
  try {
    // ON CONFLICT DO NOTHING بتمنع التكرار
    await pool.query('INSERT INTO followers (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const realCountRes = await pool.query('SELECT COUNT(*) AS c FROM followers');
    const baseCountRes = await pool.query(`SELECT value FROM stats WHERE key = 'base_followers'`);
    const realCount = parseInt(realCountRes.rows[0].c);
    const baseCount = baseCountRes.rows[0] ? parseInt(baseCountRes.rows[0].value) : 0;
    res.json({ following: true, count: baseCount + realCount });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// إلغاء المتابعة
app.post('/api/followers/unfollow', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId مطلوب' });
  try {
    await pool.query('DELETE FROM followers WHERE user_id = $1', [userId]);
    const realCountRes = await pool.query('SELECT COUNT(*) AS c FROM followers');
    const baseCountRes = await pool.query(`SELECT value FROM stats WHERE key = 'base_followers'`);
    const realCount = parseInt(realCountRes.rows[0].c);
    const baseCount = baseCountRes.rows[0] ? parseInt(baseCountRes.rows[0].value) : 0;
    res.json({ following: false, count: baseCount + realCount });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ MEDO GAMING server يعمل على port ${PORT}`);
});