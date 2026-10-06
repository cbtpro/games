#!/usr/bin/env bash
# 初始化本地 MySQL：创建 games 库 + games 用户（密码 games）
set -euo pipefail

ROOT="${DB_ROOT_USER:-root}"
ROOT_PASS="${DB_ROOT_PASSWORD:-root}"
DB_NAME="${DB_NAME:-games}"
APP_USER="${DB_APP_USER:-games}"
APP_PASS="${DB_APP_PASSWORD:-games}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

# 定位 mysql 客户端：优先 PATH，其次 macOS 官方安装路径
MYSQL_BIN=""
for candidate in "mysql" "/usr/local/mysql/bin/mysql" "/opt/homebrew/bin/mysql" "/usr/bin/mysql"; do
  if command -v "$candidate" >/dev/null 2>&1; then
    MYSQL_BIN="$candidate"
    break
  fi
done
if [ -z "$MYSQL_BIN" ]; then
  echo "❌ 找不到 mysql 客户端，请安装 MySQL 8 或设置 PATH"
  exit 1
fi

echo "➜ 使用 mysql 客户端: $MYSQL_BIN"
echo "➜ 创建数据库 ${DB_NAME} 与用户 ${APP_USER}"

"$MYSQL_BIN" -h "$DB_HOST" -P "$DB_PORT" -u "$ROOT" -p"${ROOT_PASS}" \
  --default-character-set=utf8mb4 <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${APP_USER}'@'%'         IDENTIFIED BY '${APP_PASS}';
CREATE USER IF NOT EXISTS '${APP_USER}'@'localhost' IDENTIFIED BY '${APP_PASS}';
ALTER USER '${APP_USER}'@'%'         IDENTIFIED BY '${APP_PASS}';
ALTER USER '${APP_USER}'@'localhost' IDENTIFIED BY '${APP_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${APP_USER}'@'%';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${APP_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "➜ 校验连接（使用应用账号 ${APP_USER}）"
"$MYSQL_BIN" -h "$DB_HOST" -P "$DB_PORT" -u "$APP_USER" -p"${APP_PASS}" \
  -e "SELECT 'games 数据库就绪' AS status, @@version AS mysql_version; USE \`${DB_NAME}\`; SHOW TABLES;" "${DB_NAME}"

echo "✅ 数据库初始化完成：${APP_USER}/${APP_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
