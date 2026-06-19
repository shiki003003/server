const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { nanoid } = require('nanoid');

const app = express();
app.use(express.json()); // JSONデータを受け取るための設定
app.use(express.static('public'));
let db;

// データベースの初期化
async function initDatabase() {
    db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    // URLsテーブルがなければ作成
    await db.exec(`
        CREATE TABLE IF NOT EXISTS urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            short_key TEXT UNIQUE,
            long_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

// 1. URL登録API (POST /api/shorten)
app.post('/api/shorten', async (req, res) => {
    const { long_url } = req.body;
    
    if (!long_url) {
        return res.status(400).json({ error: 'URLが必要です' });
    }

    // 5文字のランダムなIDを生成 (例: "aB3x9")
    const short_key = nanoid(5);

    try {
        await db.run(
            'INSERT INTO urls (short_key, long_url) VALUES (?, ?)',
            [short_key, long_url]
        );
        
        // 本番環境ではここを 'https://slnk.jp/' + short_key にします
        const short_url = `http://localhost:3000/${short_key}`;
        
        res.json({ short_url, short_key, long_url });
    } catch (err) {
        res.status(500).json({ error: 'データの保存に失敗しました' });
    }
});

// 2. リダイレクト処理 (GET /:short_key)
app.get('/:short_key', async (req, res) => {
    const { short_key } = req.params;

    try {
        const row = await db.get('SELECT long_url FROM urls WHERE short_key = ?', [short_key]);

        if (row) {
            // 元のURLが見つかったら、302リダイレクトで転送
            return res.redirect(302, row.long_url);
        } else {
            return res.status(404).send('お探しのURLは見つかりませんでした。(404 Not Found)');
        }
    } catch (err) {
        res.status(500).send('サーバーエラーが発生しました');
    }
});

// サーバー起動
const PORT = 3000;
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`サーバーが起動しました: http://localhost:${PORT}`);
    });
});