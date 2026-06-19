const express = require('express');
const { Pool } = require('pg');
const { nanoid } = require('nanoid');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 環境変数からデータベースURLを取得（なければローカルテスト用、ここは本番URLでもOK）
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // RenderのPostgreSQL接続に必要
});

// データベースの初期化（テーブル作成）
async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS urls (
            id SERIAL PRIMARY KEY,
            short_key TEXT UNIQUE,
            long_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

// 1. URL登録API
app.post('/api/shorten', async (req, res) => {
    const { long_url } = req.body;
    if (!long_url) return res.status(400).json({ error: 'URLが必要です' });

    const short_key = nanoid(5);

    try {
        await pool.query(
            'INSERT INTO urls (short_key, long_url) VALUES ($1, $2)',
            [short_key, long_url]
        );
        
        // 本番環境（RenderのURL）を自動で判定して返します
        const host = req.get('host');
        const short_url = `${req.protocol}://${host}/${short_key}`;
        
        res.json({ short_url, short_key, long_url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'データの保存に失敗しました' });
    }
});

// 2. リダイレクト処理
app.get('/:short_key', async (req, res) => {
    const { short_key } = req.params;

    try {
        const result = await pool.query('SELECT long_url FROM urls WHERE short_key = $1', [short_key]);

        if (result.rows.length > 0) {
            return res.redirect(302, result.rows[0].long_url);
        } else {
            return res.status(404).send('お探しのURLは見つかりませんでした。(404 Not Found)');
        }
    } catch (err) {
        res.status(500).send('サーバーエラーが発生しました');
    }
});

const PORT = process.env.PORT || 3000;
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`サーバーが起動しました: http://localhost:${PORT}`);
    });
}).catch(err => console.error("DB接続エラー:", err));