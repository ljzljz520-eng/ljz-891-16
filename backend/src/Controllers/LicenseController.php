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

        $qq = trim($_GET['qq']);
        $owner = trim($_GET['owner']);

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

            // 记录查询日志（命中）。日志写入失败不应阻断正常查询。
            $this->recordQueryLog($qq, $owner, $row['product_name'], 1);

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
            // 记录查询日志（未命中），产品留空。绝不记录验证码/密码等敏感信息。
            $this->recordQueryLog($qq, $owner, '', 0);

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
     * 写入一条前台查询记录。
     * 仅保存：查询时间(DB默认)、输入的授权QQ、输入的授权主人、所属产品、是否命中、访问IP。
     * 严禁写入验证码、密码、token 等敏感字段。
     */
    private function recordQueryLog($qq, $owner, $product, $isHit) {
        try {
            // 按字段长度截断，避免异常输入导致写入失败
            $qq      = mb_substr($qq, 0, 20);
            $owner   = mb_substr($owner, 0, 50);
            $product = mb_substr((string)$product, 0, 100);
            $ip      = $this->getClientIp();

            $sql = "INSERT INTO query_logs (queried_qq, queried_owner, product_name, is_hit, ip)
                    VALUES (:qq, :owner, :product, :hit, :ip)";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(":qq", $qq);
            $stmt->bindValue(":owner", $owner);
            $stmt->bindValue(":product", $product);
            $stmt->bindValue(":hit", $isHit ? 1 : 0, PDO::PARAM_INT);
            $stmt->bindValue(":ip", $ip);
            $stmt->execute();
        } catch (\Throwable $e) {
            // 日志失败只记录到错误日志，不影响前台查询结果
            error_log("recordQueryLog failed: " . $e->getMessage());
        }
    }

    /**
     * 获取访问者真实 IP（nginx 已透传 X-Forwarded-For / X-Real-IP）。
     * 多级代理时取 X-Forwarded-For 中第一个地址，并做格式校验防止伪造脏数据。
     */
    private function getClientIp() {
        $candidates = [];
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            foreach (explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']) as $part) {
                $candidates[] = trim($part);
            }
        }
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            $candidates[] = trim($_SERVER['HTTP_X_REAL_IP']);
        }
        if (!empty($_SERVER['REMOTE_ADDR'])) {
            $candidates[] = trim($_SERVER['REMOTE_ADDR']);
        }

        foreach ($candidates as $ip) {
            // 兼容 IPv4 / IPv6，过滤非法或伪造内容
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return mb_substr($ip, 0, 45);
            }
        }
        return '';
    }

    /**
     * 后台：查询记录列表，支持按日期区间筛选与分页。
     * GET /api/license/query-logs?start_date=2026-09-01&end_date=2026-09-29&page=1&page_size=20
     */
    public function queryLogs() {
        $where  = [];
        $params = [];

        // 按日期筛选：start_date 00:00:00 ~ end_date 23:59:59（北京时间，连接已设置 +08:00）
        $startDate = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
        $endDate   = isset($_GET['end_date'])   ? trim($_GET['end_date'])   : '';

        if ($startDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
            $where[] = "created_at >= :start";
            $params[':start'] = $startDate . ' 00:00:00';
        }
        if ($endDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            $where[] = "created_at <= :end";
            $params[':end'] = $endDate . ' 23:59:59';
        }

        $whereSql = $where ? ("WHERE " . implode(' AND ', $where)) : '';

        // 统计总数与命中数（命中数同样受日期条件约束）
        $countSql = "SELECT COUNT(*) AS total,
                            SUM(CASE WHEN is_hit = 1 THEN 1 ELSE 0 END) AS hit_count
                     FROM query_logs $whereSql";
        $countStmt = $this->db->prepare($countSql);
        $countStmt->execute($params);
        $stat = $countStmt->fetch(PDO::FETCH_ASSOC);
        $total     = (int)($stat['total'] ?? 0);
        $hitCount  = (int)($stat['hit_count'] ?? 0);

        // 分页
        $page     = max(1, isset($_GET['page']) ? (int)$_GET['page'] : 1);
        $pageSize = isset($_GET['page_size']) ? (int)$_GET['page_size'] : 20;
        $pageSize = min(100, max(1, $pageSize));
        $offset   = ($page - 1) * $pageSize;

        $listSql = "SELECT id, queried_qq, queried_owner, product_name, is_hit, ip, created_at
                    FROM query_logs $whereSql
                    ORDER BY id DESC
                    LIMIT $pageSize OFFSET $offset";
        $listStmt = $this->db->prepare($listSql);
        $listStmt->execute($params);
        $logs = $listStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'total'      => $total,
            'hit_count'  => $hitCount,
            'miss_count' => $total - $hitCount,
            'page'       => $page,
            'page_size'  => $pageSize,
            'list'       => $logs
        ], JSON_UNESCAPED_UNICODE);
    }

    /**
     * 后台：导出查询记录 CSV（受同样的日期条件约束）。
     * GET /api/license/export-logs?start_date=...&end_date=...
     * 导出列顺序按客服核对习惯排列，不包含任何敏感字段。
     */
    public function exportLogs() {
        $where  = [];
        $params = [];

        $startDate = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
        $endDate   = isset($_GET['end_date'])   ? trim($_GET['end_date'])   : '';

        if ($startDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
            $where[] = "created_at >= :start";
            $params[':start'] = $startDate . ' 00:00:00';
        }
        if ($endDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            $where[] = "created_at <= :end";
            $params[':end'] = $endDate . ' 23:59:59';
        }

        $whereSql = $where ? ("WHERE " . implode(' AND ', $where)) : '';

        // 单次导出上限保护
        $sql = "SELECT queried_qq, queried_owner, product_name, is_hit, ip, created_at
                FROM query_logs $whereSql
                ORDER BY id DESC
                LIMIT 10000";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 客服核对习惯的字段顺序：时间 → QQ → 授权主人 → 所属产品 → 是否命中 → IP
        $headers = ['查询时间', '授权QQ', '授权主人', '所属产品', '是否命中', '访问IP'];

        $rangeName = '';
        if ($startDate && $endDate)      $rangeName = $startDate . '_' . $endDate;
        elseif ($startDate)              $rangeName = $startDate . '起';
        elseif ($endDate)                $rangeName = '截至' . $endDate;
        else                             $rangeName = '全部';
        $fileName = '查询记录_' . $rangeName . '.csv';

        // 清空之前可能输出的内容并以附件下载
        if (ob_get_level() > 0) { ob_end_clean(); }
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $fileName . '"; filename*=UTF-8\'\'' . rawurlencode($fileName));
        header('Cache-Control: no-store, no-cache, must-revalidate');

        // UTF-8 BOM，保证 Excel 打开中文不乱码
        echo "\xEF\xBB\xBF";

        $out = fopen('php://output', 'w');
        fputcsv($out, $headers);

        foreach ($rows as $row) {
            fputcsv($out, [
                $row['created_at'],
                $this->csvCell($row['queried_qq'], true), // QQ 按文本处理，避免 Excel 变成科学计数法
                $this->csvCell($row['queried_owner']),
                $this->csvCell($row['product_name']),
                ((int)$row['is_hit'] === 1) ? '命中' : '未命中',
                $this->csvCell($row['ip'])
            ]);
        }
        fclose($out);
        exit;
    }

    /**
     * CSV 单元格安全处理：
     * 1) 防止公式注入（= + - @ Tab 回车开头的内容加单引号前缀）；
     * 2) 去除可能破坏列结构的控制字符；
     * 3) $asText=true 时用 ="xxx" 形式让 Excel/WPS 把长数字（QQ）识别为文本。
     */
    private function csvCell($value, $asText = false) {
        $value = (string)$value;
        // 去掉制表符/换行等会破坏 CSV 列结构的控制字符
        $value = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value);
        $value = trim($value);

        if ($asText) {
            // ="123456789" —— Excel/WPS 均识别为文本，避免 QQ 被科学计数法显示
            $escaped = str_replace('"', '""', $value);
            return '="' . $escaped . '"';
        }

        // CSV 公式注入防护
        if ($value !== '' && preg_match('/^[=+\-\t\r\n@]/', $value)) {
            $value = "'" . $value;
        }
        return $value;
    }

    // Admin: List All
    public function listAll() {
        $query = "SELECT * FROM licenses ORDER BY created_at DESC";
        $stmt = $this->db->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
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
