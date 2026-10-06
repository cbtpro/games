-- 游戏平台数据库初始化脚本
-- 用法：mysql -u root -p < scripts/db/00-init-database.sql
-- 建表由 TypeORM synchronize 完成（开发环境）；生产环境请改用 migrations 并关闭 DB_SYNC。

CREATE DATABASE IF NOT EXISTS `games`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- MySQL 8 推荐使用 CREATE USER + GRANT 两段式
CREATE USER IF NOT EXISTS 'games'@'%'       IDENTIFIED BY 'games';
CREATE USER IF NOT EXISTS 'games'@'localhost' IDENTIFIED BY 'games';

ALTER USER 'games'@'%'       IDENTIFIED BY 'games';
ALTER USER 'games'@'localhost' IDENTIFIED BY 'games';

GRANT ALL PRIVILEGES ON `games`.* TO 'games'@'%';
GRANT ALL PRIVILEGES ON `games`.* TO 'games'@'localhost';

FLUSH PRIVILEGES;

-- 校验
SHOW DATABASES LIKE 'games';
SHOW GRANTS FOR 'games'@'localhost';
