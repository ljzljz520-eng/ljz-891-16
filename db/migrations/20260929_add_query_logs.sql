-- 迁移：前台查询记录表（已有数据卷时手动执行：
--   docker exec -i auth_db mysql -uroot -proot auth_system < db/migrations/20260929_add_query_logs.sql
-- 正常情况下应用启动后会通过 Database::ensureSchema() 幂等自动创建，无需手动执行）
USE auth_system;

CREATE TABLE IF NOT EXISTS query_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    queried_qq VARCHAR(20) NOT NULL COMMENT '用户输入的授权QQ',
    queried_owner VARCHAR(50) NOT NULL DEFAULT '' COMMENT '用户输入的授权主人',
    product_name VARCHAR(100) NOT NULL DEFAULT '' COMMENT '命中时记录所属产品，未命中为空',
    is_hit TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否命中授权 1=命中 0=未命中',
    ip VARCHAR(45) NOT NULL DEFAULT '' COMMENT '访问IP，兼容IPv6',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '查询时间',
    INDEX idx_created_at (created_at),
    INDEX idx_qq (queried_qq),
    INDEX idx_hit (is_hit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
