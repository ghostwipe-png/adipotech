-- Table for storing posts and their content metadata
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT, -- 'image', 'video', 'pdf'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for enforcement policies (per post)
CREATE TABLE IF NOT EXISTS policies (
    post_id TEXT PRIMARY KEY,
    require_like BOOLEAN DEFAULT FALSE,
    require_comment BOOLEAN DEFAULT FALSE,
    require_subscribe BOOLEAN DEFAULT FALSE,
    require_donate_amount INTEGER DEFAULT 0, -- 0 means no donation required
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);