-- 迁移脚本：为已存在的 auth_system 数据库增加前台查询记录表
-- 用法：mysql -uroot -p auth_system < migration_query_logs.sql
SET NAMES utf8mb4;

USE auth_system;

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
