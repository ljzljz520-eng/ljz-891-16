# 星罗授权管理系统 (AuthQuery System)

## 🛠 技术栈
- Frontend: React + Vite + Tailwind CSS (Glassmorphism / Tech Blue)
- Backend: PHP 8.2 + Apache (MVC + PHPMailer)
- Database: MySQL 8.0

## 🚀 启动指南
1. 确保 Docker Desktop 已启动。
2. 在根目录执行：`docker compose up --build`
3. 访问: http://localhost:3891

## 🔗 服务说明
- **前端页面**: http://localhost:3891
- **API 接口**: http://localhost:8891
- **Mysql**: localhost:18891 (root/root)

## 🧪 管理员账号
- 登录地址: `/admin`
- 账号: `admin`
- 密码: `123456`

## ✨ 核心功能
1. **正版查询**: 动态极光背景，支持 QQ/主人 双重验证。
2. **自助更绑**: 集成 PHPMailer 发送真实 QQ 邮件验证码 (SMTP: yuwangifeng@163.com)。
   - 若发送失败，请在 `docker logs auth_backend` 查看 SMTP 错误日志。
3. **后台管理**: 
   - 现代化表格设计 (头像/状态徽章)。
   - 自定义玻璃拟态弹窗 (Modal) 代替原生 Alert。
   - 完备的 CRUD 功能。
4. **前台查询记录**:
   - 每次前台查询自动记录：查询时间、输入的授权QQ、授权主人、所属产品（命中时）、是否命中、访问IP。
   - 后台「查询记录」标签支持按开始/结束日期筛选，提供今天 / 近7天 / 近30天快捷选项与命中统计。
   - 支持一键导出 CSV（UTF-8 BOM，Excel 直接打开不乱码），列顺序为：查询时间 → 授权QQ → 授权主人 → 所属产品 → 是否命中 → 访问IP，便于客服核对。
   - 出于安全考虑，记录表**不写入**任何验证码、管理员密码等敏感信息。

## 🗄 数据库迁移（已有数据库）
新部署会自动在 `db/init.sql` 中创建 `query_logs` 表。
若数据库已存在数据卷，请手动执行：
```bash
mysql -h127.0.0.1 -P18891 -uroot -proot auth_system < db/migration_query_logs.sql
```

## 📝 交付文档
- `SELF_TEST.md`: 完整的自测报告与架构说明。
