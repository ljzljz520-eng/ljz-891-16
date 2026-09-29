SET NAMES utf8mb4;
SET TIME_ZONE = '+08:00';

CREATE DATABASE IF NOT EXISTS auth_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auth_system;

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Licenses Table
CREATE TABLE IF NOT EXISTS licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    qq VARCHAR(20) NOT NULL,
    owner_name VARCHAR(50) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    upline VARCHAR(50) NOT NULL COMMENT '上级代理',
    expiration_date DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_qq (qq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verification Codes (for updates)
CREATE TABLE IF NOT EXISTS verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'update_license'
    identifier VARCHAR(100) NOT NULL, -- QQ email
    code VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Frontend Query Logs (客服核对用)
-- 注意：仅记录查询行为，严禁写入验证码、密码等敏感信息
CREATE TABLE IF NOT EXISTS query_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    queried_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '查询时间',
    qq VARCHAR(20) NOT NULL COMMENT '输入的授权QQ',
    owner_name VARCHAR(50) DEFAULT NULL COMMENT '输入的授权主人（便于核对）',
    product_name VARCHAR(100) DEFAULT NULL COMMENT '命中记录的所属产品，未命中为空',
    is_hit TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否命中：1是 0否',
    ip VARCHAR(45) DEFAULT NULL COMMENT '访问IP（兼容IPv4/IPv6）',
    INDEX idx_queried_at (queried_at),
    INDEX idx_qq (qq),
    INDEX idx_is_hit (is_hit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data (Test Accounts)
-- Password is '123456' hashed with BCRYPT (Cost 10)
INSERT INTO admins (username, password) VALUES 
('admin', '$2y$10$eLYd0HGc9JM0qxzPkpLtDuL1UZRAS6XAwgVNO7oL9R0M/f/6bkEcW'); 

-- Seed Data (Sample Licenses)
INSERT INTO licenses (qq, owner_name, product_name, upline, expiration_date) VALUES 
('123456789', '张三', '超级授权系统VIP版', '总代理', '2026-12-31 23:59:59'),
('987654321', '李四', '企业级管理后台', '核心代理', '2025-06-30 23:59:59'),
('11111', '王五', '测试过期产品', '测试员', '2023-01-01 00:00:00'); -- Expired
