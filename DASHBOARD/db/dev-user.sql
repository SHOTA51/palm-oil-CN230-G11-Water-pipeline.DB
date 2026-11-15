-- Local development only (docker compose). The dashboard API only reads,
-- so its user gets SELECT and nothing else.
CREATE USER IF NOT EXISTS 'dashboard_app'@'%' IDENTIFIED BY 'dashboard_app_pw';
GRANT SELECT ON `plam-oil`.* TO 'dashboard_app'@'%';
FLUSH PRIVILEGES;
