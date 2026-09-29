<?php
namespace Controllers;

use Config\Database;
use PDO;

class LicenseController {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    // Public Query
    public function query() {
        if (!isset($_GET['qq']) || !isset($_GET['owner'])) {
            http_response_code(400);
            echo json_encode(["message" => "Missing parameters"]);
            return;
        }

        $qq = $this->truncate($_GET['qq'], 20);
        $owner = $this->truncate($_GET['owner'], 50);

        $query = "SELECT * FROM licenses WHERE qq = :qq AND owner_name = :owner LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(":qq", $qq);
        $stmt->bindParam(":owner", $owner);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            // Check if expired logic? The prompt says just show info.
            // But prompt also lists reasons for failure: "1.授权开通不足60分钟内" (implies < 60 mins from creation?) - this is weird, maybe it means 'just created'? or 'not synced'?
            // Usually "Authorization not found" reasons are generic boilerplate.
            // Let's just return the data.

            // 记录命中查询（不记录任何验证码/密码类信息）
            $this->recordQuery($qq, $owner, $row['product_name'], 1);

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "data" => [
                    "qq" => $row['qq'],
                    "owner" => $row['owner_name'],
                    "product" => $row['product_name'],
                    "upline" => $row['upline'],
                    "expiration" => $row['expiration_date'],
                    "created_at" => $row['created_at']
                ]
            ]);
        } else {
            // 记录未命中查询
            $this->recordQuery($qq, $owner, null, 0);

            // Failure with specific message
            http_response_code(404);
            echo json_encode([
                "status" => "error",
                "message" => "暂未查询到您的授权信息 请查证后再次查询！",
                "reasons" => [
                    "1.授权开通不足60分钟内",
                    "2.未购买正版授权，可能是盗版程序授权",
                    "3.恭喜你，被圈钱了！"
                ]
            ]);
        }
    }

    /**
     * 记录一次前台查询行为。
     * 仅保存：授权QQ、授权主人、所属产品、是否命中、访问IP、查询时间。
     * 绝不写入验证码、密码等敏感字段；写入失败不影响正常查询。
     */
    private function recordQuery($qq, $owner, $product, $isHit) {
        try {
            $sql = "INSERT INTO query_logs (qq, owner_name, product_name, is_hit, ip)
                    VALUES (:qq, :owner, :product, :hit, :ip)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':qq'      => $this->truncate($qq, 20),
                ':owner'   => $owner !== null && $owner !== '' ? $this->truncate($owner, 50) : null,
                ':product' => $product !== null ? $this->truncate($product, 100) : null,
                ':hit'     => $isHit ? 1 : 0,
                ':ip'      => $this->getClientIp(),
            ]);
        } catch (\PDOException $e) {
            error_log("recordQuery failed: " . $e->getMessage());
        }
    }

    /**
     * 获取访问IP（经 nginx 代理时读取 X-Real-IP / X-Forwarded-For）。
     */
    private function getClientIp() {
        $ip = null;
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            $ip = $_SERVER['HTTP_X_REAL_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $ip = trim($parts[0]);
        } elseif (!empty($_SERVER['REMOTE_ADDR'])) {
            $ip = $_SERVER['REMOTE_ADDR'];
        }
        // 校验格式并限制长度，防止脏数据注入
        if ($ip !== null && filter_var($ip, FILTER_VALIDATE_IP)) {
            return substr($ip, 0, 45);
        }
        return null;
    }

    /**
     * 截断字符串，保证不超出字段长度。
     */
    private function truncate($value, $maxLen) {
        $value = trim((string)$value);
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, $maxLen);
        }
        return substr($value, 0, $maxLen);
    }

    // Admin: List All
    public function listAll() {
        $query = "SELECT * FROM licenses ORDER BY created_at DESC";
        $stmt = $this->db->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
    }

    /**
     * 后台：查询记录列表，支持按日期区间筛选
     * GET /api/license/query-logs?start=YYYY-MM-DD&end=YYYY-MM-DD
     */
    public function queryLogs() {
        list($where, $params) = $this->buildLogDateFilter();

        $sql = "SELECT id, queried_at, qq, owner_name, product_name, is_hit, ip
                FROM query_logs {$where}
                ORDER BY queried_at DESC, id DESC
                LIMIT 2000";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 统计当前筛选条件下的命中情况，便于客服快速核对
        $statsStmt = $this->db->prepare(
            "SELECT COUNT(*) AS total,
                    SUM(is_hit = 1) AS hit_count,
                    SUM(is_hit = 0) AS miss_count
             FROM query_logs {$where}"
        );
        $statsStmt->execute($params);
        $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            "logs"  => $rows,
            "stats" => [
                "total" => (int)$stats['total'],
                "hit"   => (int)$stats['hit_count'],
                "miss"  => (int)$stats['miss_count'],
            ],
        ]);
    }

    /**
     * 后台：导出查询记录为 CSV（字段顺序按客服核对习惯排列）
     * GET /api/license/query-logs/export?start=YYYY-MM-DD&end=YYYY-MM-DD
     */
    public function exportQueryLogs() {
        list($where, $params) = $this->buildLogDateFilter();

        $stmt = $this->db->prepare(
            "SELECT queried_at, qq, owner_name, product_name, is_hit, ip
             FROM query_logs {$where}
             ORDER BY queried_at DESC, id DESC"
        );
        $stmt->execute($params);

        // UTF-8 BOM，保证 Excel 打开中文不乱码
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="query_logs_' . date('YmdHis') . '.csv"');
        header('Cache-Control: no-store, no-cache, must-revalidate');

        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF");

        // 列顺序：客服核对时先看时间，再核对 QQ / 主人 / 产品，再看是否命中，最后看来源IP
        fputcsv($out, ['查询时间', '授权QQ', '授权主人', '所属产品', '是否命中', '访问IP']);

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($out, [
                $row['queried_at'],
                $this->csvText($row['qq']),
                $this->csvText($row['owner_name']),
                $this->csvText($row['product_name']),
                (int)$row['is_hit'] === 1 ? '命中' : '未命中',
                $this->csvText($row['ip']),
            ]);
        }
        fclose($out);
    }

    /**
     * 根据 start / end 参数构造日期过滤条件（参数经过严格格式校验）。
     */
    private function buildLogDateFilter() {
        $where = '';
        $params = [];

        $start = isset($_GET['start']) ? trim($_GET['start']) : '';
        $end   = isset($_GET['end']) ? trim($_GET['end']) : '';

        if ($start !== '' && $this->isValidDate($start)) {
            $where .= "WHERE queried_at >= :start";
            $params[':start'] = $start . ' 00:00:00';
        }
        if ($end !== '' && $this->isValidDate($end)) {
            $where .= ($where === '' ? 'WHERE ' : ' AND ') . "queried_at <= :end";
            $params[':end'] = $end . ' 23:59:59';
        }
        return [$where, $params];
    }

    private function isValidDate($value) {
        $d = \DateTime::createFromFormat('Y-m-d', $value);
        return $d && $d->format('Y-m-d') === $value;
    }

    /**
     * CSV 单元格处理：空值统一为 '-'，自由文本防公式注入。
     * QQ / IP 为纯数字或点分格式，不会被 Excel 当公式，但仍对异常输入做防护。
     */
    private function csvText($value) {
        if ($value === null || $value === '') {
            return '-';
        }
        $value = (string)$value;
        // 纯数字、IPv4/IPv6 常见字符直接输出，避免 QQ/IP 被误加前缀
        if (preg_match('/^[0-9A-Fa-f:\.]+$/', $value)) {
            return $value;
        }
        if (preg_match('/^[=+\-@\t\r]/', $value)) {
            return "'" . $value;
        }
        return $value;
    }

    // Admin: Create
    public function create() {
        $data = json_decode(file_get_contents("php://input"));
        // Need: qq, owner_name, product_name, upline, expiration_date
        $query = "INSERT INTO licenses (qq, owner_name, product_name, upline, expiration_date) VALUES (:qq, :owner, :product, :upline, :exp)";
        $stmt = $this->db->prepare($query);
        
        $params = [
            ":qq" => $data->qq,
            ":owner" => $data->owner_name,
            ":product" => $data->product_name,
            ":upline" => $data->upline,
            ":exp" => $data->expiration_date
        ];
        
        if($stmt->execute($params)) {
             echo json_encode(["message" => "Created successfully"]);
        } else {
             http_response_code(500);
             echo json_encode(["message" => "Create failed"]);
        }
    }
    
    // Admin: Delete
    public function delete() {
         $data = json_decode(file_get_contents("php://input"));
         if(!isset($data->id)) { return; }
         $query = "DELETE FROM licenses WHERE id = :id";
         $stmt = $this->db->prepare($query);
         $stmt->bindParam(":id", $data->id);
         $stmt->execute();
         echo json_encode(["message" => "Deleted"]);
    }

    // Update Flow: Step 1 - Send Code
    public function sendVerificationCode() {
        $data = json_decode(file_get_contents("php://input"));
        $qq = $data->qq;
        $email = $qq . "@qq.com";
        
        $code = rand(100000, 999999);
        
        // Save code
        $stmt = $this->db->prepare("INSERT INTO verification_codes (type, identifier, code, expires_at) VALUES ('update_license', :email, :code, DATE_ADD(NOW(), INTERVAL 10 MINUTE))");
        $stmt->execute([':email' => $email, ':code' => $code]);
        
        // Real Email Sending via PHPMailer
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        try {
            //Server settings
            $mail->SMTPDebug = 2; // Enable verbose debug output
            $mail->Debugoutput = 'error_log'; // Output to stderr
            $mail->isSMTP();
            $mail->Host       = 'smtp.163.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'yuwangifeng@163.com';
            $mail->Password   = 'LRZMA358wePVGa8F'; 
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = 465;
            $mail->CharSet    = 'UTF-8';

            // Allow self-signed certs (matches Node.js permissive behavior)
            $mail->SMTPOptions = array(
                'ssl' => array(
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true
                )
            );

            //Recipients - Name removed to match Node example exactly
            $mail->setFrom('yuwangifeng@163.com');
            $mail->addAddress($email);
            
            // Set HELO to localhost to avoid Docker container ID rejection
            $mail->Hostname = 'localhost';

            //Content
            $mail->isHTML(true);
            $mail->Subject = '【授权系统】验证码';
            $mail->Body    = "您的验证码是 <b>$code</b>，请在10分钟内完成验证。<br>如非本人操作请忽略。";

            $mail->send();
            echo json_encode(["message" => "验证码已发送至QQ邮箱"]);
        } catch (\Exception $e) {
            // Fallback for demo/dev if SMTP fails
            error_log("SMTP Error: {$mail->ErrorInfo}");
            echo json_encode([
                 "message" => "邮件发送失败 (转为模拟模式)", 
                 "mock_code" => $code,
                 "debug_error" => $mail->ErrorInfo
            ]);
        }
    }

    // Update Flow: Step 2 - Verify & Update
    public function update() {
        $data = json_decode(file_get_contents("php://input"));
        // Expect: qq, code, new_owner, new_product...
        
        $email = $data->qq . "@qq.com";
        $code = $data->code;
        
        // Verify Code
        $stmt = $this->db->prepare("SELECT * FROM verification_codes WHERE identifier=:email AND code=:code AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $stmt->execute([':email' => $email, ':code' => $code]);
        
        if ($stmt->rowCount() == 0) {
            http_response_code(400);
            echo json_encode(["message" => "Invalid or expired code"]);
            return;
        }
        
        // Update License
        // For demo, assume we update the owner name for this QQ
        $updateQ = "UPDATE licenses SET owner_name = :new_owner WHERE qq = :qq";
        $ustmt = $this->db->prepare($updateQ);
        $ustmt->execute([':new_owner' => $data->owner_name, ':qq' => $data->qq]); // assuming we update owner
        
        echo json_encode(["message" => "Update successful"]);
    }
}
