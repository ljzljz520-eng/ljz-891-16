<?php
namespace Config;

use PDO;
use PDOException;

class Database {
    private $host = 'db';
    private $db_name = 'auth_system';
    private $username = 'root';
    private $password = 'root';
    public $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $dsn = "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4";
            $this->conn = new PDO($dsn, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("set names utf8mb4");
            // 时间统一按北京时间存取，保证后台“按日期筛选”与展示一致
            $this->conn->exec("SET time_zone = '+08:00'");
            // 幂等补齐增量表结构（兼容已存在的数据库卷）
            $this->ensureSchema();
        } catch(PDOException $exception) {
            echo "Connection error: " . $exception->getMessage();
        }
        return $this->conn;
    }

    /**
     * 增量建表：新增表通过 IF NOT EXISTS 幂等创建，不影响已有数据。
     */
    private function ensureSchema() {
        $this->conn->exec("
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }
}
