-- AI Meeting 数据库初始化脚本

-- 创建数据库 (如果使用 docker-compose，数据库已自动创建)
-- CREATE DATABASE ai_meeting;

-- 连接到数据库
\c ai_meeting;

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 设置时区
SET timezone = 'Asia/Shanghai';

-- 创建用户表 (TypeORM 会自动创建，这里仅作参考)
-- CREATE TABLE IF NOT EXISTS users (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     email VARCHAR(255) UNIQUE NOT NULL,
--     password VARCHAR(255) NOT NULL,
--     nickname VARCHAR(100) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- 创建刷新令牌表
-- CREATE TABLE IF NOT EXISTS refresh_tokens (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     token VARCHAR(500) NOT NULL,
--     expires_at TIMESTAMP NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- 创建索引
-- CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
-- CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

GRANT ALL PRIVILEGES ON DATABASE ai_meeting TO postgres;

-- 初始化完成
SELECT 'Database initialized successfully' AS status;
