# Mini-Shopify 阿里云ECS运维指引

> 本文档针对已部署到阿里云ECS的Mini-Shopify项目，提供日常运维操作指南。

---

## 目录

1. [服务管理](#一服务管理)
2. [后端发布与重启](#二后端发布与重启)
3. [日志查看](#三日志查看)
4. [数据库运维](#四数据库运维)
5. [常见问题处理](#五常见问题处理)
6. [监控与告警](#六监控与告警)

---

## 一、服务管理

### 1.1 服务状态检查

```bash
# 查看所有服务状态
pm2 status

# 查看Nginx状态
systemctl status nginx

# 查看MySQL状态
systemctl status mysql        # Ubuntu
systemctl status mysqld       # CentOS

# 查看端口监听情况
netstat -tlnp | grep -E '3001|80|3306'
# 或
ss -tlnp | grep -E '3001|80|3306'
```

### 1.2 服务启停命令

| 服务 | 启动 | 停止 | 重启 | 查看状态 |
|------|------|------|------|----------|
| 后端(PM2) | `pm2 start mini-shopify-backend` | `pm2 stop mini-shopify-backend` | `pm2 restart mini-shopify-backend` | `pm2 status` |
| Nginx | `systemctl start nginx` | `systemctl stop nginx` | `systemctl restart nginx` | `systemctl status nginx` |
| MySQL | `systemctl start mysql` | `systemctl stop mysql` | `systemctl restart mysql` | `systemctl status mysql` |

### 1.3 PM2常用操作

```bash
# 启动应用
pm2 start ecosystem.config.js --env production

# 停止应用
pm2 stop mini-shopify-backend

# 重启应用
pm2 restart mini-shopify-backend

# 平滑重启（零停机）
pm2 reload mini-shopify-backend

# 查看应用详情
pm2 show mini-shopify-backend

# 查看进程列表
pm2 list

# 保存当前进程配置
pm2 save

# 删除应用
pm2 delete mini-shopify-backend
```

---

## 二、后端发布与重启

### 2.1 快速重启（仅重启服务，不更新代码）

```bash
# 方法1：使用PM2重启
pm2 restart mini-shopify-backend

# 方法2：平滑重启（推荐，零停机）
pm2 reload mini-shopify-backend

# 查看重启后的状态
pm2 status
pm2 logs mini-shopify-backend --lines 20
```

### 2.2 完整发布流程（更新代码并重启）

```bash
cd /var/www/mini-shopify

# 1. 拉取最新代码
git pull origin main

# 2. 更新后端
cd packages/backend
npm install
npx prisma generate
npx prisma db push
npm run build

# 3. 更新前端
cd ../frontend
npm install
npm run build
cp -r dist/* /var/www/mini-shopify/frontend-dist/

# 4. 重启后端服务
cd /var/www/mini-shopify
pm2 restart mini-shopify-backend

# 5. 验证部署
curl http://localhost:3001/api/config
```

### 2.3 使用一键部署脚本

```bash
# 执行部署脚本
/var/www/mini-shopify/deploy.sh

# 查看部署日志
tail -f /var/log/mini-shopify/deploy.log
```

### 2.4 数据库变更发布

**仅修改代码，无数据库变更：**
```bash
cd /var/www/mini-shopify/packages/backend
git pull
npm install
npm run build
pm2 restart mini-shopify-backend
```

**有数据库Schema变更：**
```bash
cd /var/www/mini-shopify/packages/backend

# 1. 备份数据库（重要！）
mysqldump -u shopify_qimen -p mini_shopify > /var/backups/mysql/backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 拉取代码并更新
git pull
npm install

# 3. 更新Prisma Client
npx prisma generate

# 4. 应用数据库变更
npx prisma db push

# 5. 构建并重启
npm run build
pm2 restart mini-shopify-backend
```

### 2.5 回滚操作

**代码回滚：**
```bash
cd /var/www/mini-shopify

# 查看提交历史
git log --oneline -10

# 回滚到指定版本
git reset --hard <commit-hash>

# 重新构建并重启
cd packages/backend
npm run build
pm2 restart mini-shopify-backend
```

**数据库回滚（如有备份）：**
```bash
# 从备份恢复
mysql -u shopify_qimen -p mini_shopify < /var/backups/mysql/backup_20240101_120000.sql
```

---

## 三、日志查看

### 3.1 应用日志（PM2）

```bash
# 查看实时日志
pm2 logs mini-shopify-backend

# 查看最近100行日志
pm2 logs mini-shopify-backend --lines 100

# 查看错误日志
pm2 logs mini-shopify-backend --err

# 查看输出日志
pm2 logs mini-shopify-backend --out

# 清空日志
pm2 flush mini-shopify-backend
```

**日志文件位置：**
- 输出日志：`/var/log/mini-shopify/out.log`
- 错误日志：`/var/log/mini-shopify/error.log`

### 3.2 Nginx日志

```bash
# 查看访问日志（实时）
tail -f /var/log/nginx/access.log

# 查看错误日志（实时）
tail -f /var/log/nginx/error.log

# 查看最近50条错误
 tail -n 50 /var/log/nginx/error.log

# 查找特定状态码（如502错误）
grep " 502 " /var/log/nginx/access.log

# 查找特定IP的访问记录
grep "192.168.1.1" /var/log/nginx/access.log
```

### 3.3 系统日志

```bash
# 查看系统日志
journalctl -xe

# 查看Nginx服务日志
journalctl -u nginx -f

# 查看MySQL日志
journalctl -u mysql -f

# 查看指定时间段的日志
journalctl --since "2024-01-01 10:00:00" --until "2024-01-01 12:00:00"
```

### 3.4 数据库日志

```bash
# MySQL错误日志（Ubuntu）
tail -f /var/log/mysql/error.log

# MySQL错误日志（CentOS）
tail -f /var/log/mysqld.log

# 查看慢查询日志（如已启用）
tail -f /var/log/mysql/slow.log
```

### 3.5 日志搜索技巧

```bash
# 搜索包含特定关键词的日志
grep "error" /var/log/mini-shopify/error.log

# 搜索特定时间段的日志
grep "2024-01-01" /var/log/mini-shopify/out.log

# 实时过滤日志
pm2 logs | grep "ERROR"

# 查看日志最后100行并跟踪
tail -f -n 100 /var/log/mini-shopify/out.log
```

---

## 四、数据库运维

### 4.1 数据库连接

```bash
# 登录MySQL
mysql -u shopify_qimen -p

# 直接执行SQL命令
mysql -u shopify_qimen -p -e "SHOW DATABASES;"

# 导出数据库
mysqldump -u shopify_qimen -p mini_shopify > backup.sql

# 导出特定表
mysqldump -u shopify_qimen -p mini_shopify merchant > merchant_backup.sql

# 导入数据库
mysql -u shopify_qimen -p mini_shopify < backup.sql
```

### 4.2 常用SQL查询

```sql
-- 查看所有表
SHOW TABLES;

-- 查看表结构
DESCRIBE merchant;

-- 查看表记录数
SELECT COUNT(*) FROM merchant;

-- 查看最近创建的商户
SELECT * FROM merchant ORDER BY createdAt DESC LIMIT 10;

-- 查看KYC状态统计
SELECT kycStatus, COUNT(*) FROM merchant GROUP BY kycStatus;
```

### 4.3 数据库备份

```bash
# 手动备份
cd /var/www/mini-shopify
./backup.sh

# 查看备份文件
ls -lh /var/backups/mysql/

# 备份文件命名格式：mini_shopify_YYYYMMDD_HHMMSS.sql.gz
```

### 4.4 定时备份配置

```bash
# 编辑定时任务
crontab -e

# 添加每天凌晨2点自动备份
0 2 * * * /var/www/mini-shopify/backup.sh >> /var/log/mini-shopify/backup.log 2>&1

# 查看定时任务
crontab -l
```

---

## 五、常见问题处理

### 5.1 502 Bad Gateway

**现象：** 访问网站显示502错误

**排查步骤：**
```bash
# 1. 检查后端服务是否运行
pm2 status

# 2. 检查后端端口是否监听
netstat -tlnp | grep 3001

# 3. 查看后端错误日志
pm2 logs mini-shopify-backend --lines 50

# 4. 检查Nginx配置
nginx -t

# 5. 重启服务
pm2 restart mini-shopify-backend
systemctl restart nginx
```

### 5.2 前端页面空白或404

**排查步骤：**
```bash
# 1. 检查静态文件是否存在
ls -la /var/www/mini-shopify/frontend-dist/

# 2. 检查Nginx配置中的root路径
grep "root" /etc/nginx/conf.d/mini-shopify.conf

# 3. 重新构建前端
cd /var/www/mini-shopify/packages/frontend
npm run build
cp -r dist/* /var/www/mini-shopify/frontend-dist/

# 4. 重启Nginx
systemctl restart nginx
```

### 5.3 数据库连接失败

**排查步骤：**
```bash
# 1. 检查MySQL服务状态
systemctl status mysql

# 2. 检查MySQL端口
netstat -tlnp | grep 3306

# 3. 测试数据库连接
mysql -u shopify_qimen -p -e "SELECT 1;"

# 4. 查看MySQL错误日志
tail -f /var/log/mysql/error.log

# 5. 重启MySQL
systemctl restart mysql
```

### 5.4 内存不足

**排查步骤：**
```bash
# 1. 查看内存使用情况
free -h

# 2. 查看进程内存占用
ps aux --sort=-%mem | head -20

# 3. 查看PM2进程内存
pm2 show mini-shopify-backend | grep memory

# 4. 清理Nginx缓存
rm -rf /var/cache/nginx/*

# 5. 重启服务释放内存
pm2 restart mini-shopify-backend
systemctl restart nginx
```

### 5.5 磁盘空间不足

**排查步骤：**
```bash
# 1. 查看磁盘使用情况
df -h

# 2. 查看大文件
find /var/log -type f -size +100M

# 3. 清理日志文件
pm2 flush
find /var/log/nginx -name "*.log" -type f -mtime +7 -delete

# 4. 清理旧备份
find /var/backups/mysql -name "*.sql.gz" -mtime +30 -delete
```

---

## 六、监控与告警

### 6.1 系统资源监控

```bash
# 实时查看系统资源
top
htop

# 查看CPU和内存
vmstat 1 10

# 查看磁盘IO
iostat -x 1 10

# 查看网络连接
netstat -an | grep ESTABLISHED | wc -l
```

### 6.2 应用健康检查

```bash
# 检查后端API是否正常
curl -f http://localhost:3001/api/config && echo "OK" || echo "FAILED"

# 检查前端是否正常
curl -f http://localhost/ && echo "OK" || echo "FAILED"

# 检查数据库连接
mysql -u shopify_qimen -p -e "SELECT 1;" && echo "DB OK" || echo "DB FAILED"
```

### 6.3 设置健康检查脚本

```bash
cat > /var/www/mini-shopify/health-check.sh << 'EOF'
#!/bin/bash

# 检查后端API
if ! curl -f -s http://localhost:3001/api/config > /dev/null; then
    echo "$(date): 后端服务异常，尝试重启..." >> /var/log/mini-shopify/health-check.log
    pm2 restart mini-shopify-backend
fi

# 检查Nginx
if ! systemctl is-active --quiet nginx; then
    echo "$(date): Nginx未运行，尝试重启..." >> /var/log/mini-shopify/health-check.log
    systemctl restart nginx
fi

# 检查MySQL
if ! systemctl is-active --quiet mysql; then
    echo "$(date): MySQL未运行，尝试重启..." >> /var/log/mini-shopify/health-check.log
    systemctl restart mysql
fi
EOF

chmod +x /var/www/mini-shopify/health-check.sh

# 添加定时任务（每5分钟检查一次）
crontab -e
# 添加：*/5 * * * * /var/www/mini-shopify/health-check.sh
```

---

## 快速命令参考

```bash
# === 服务状态 ===
pm2 status                                    # 查看PM2进程状态
systemctl status nginx                        # 查看Nginx状态
systemctl status mysql                        # 查看MySQL状态

# === 重启服务 ===
pm2 restart mini-shopify-backend              # 重启后端
pm2 reload mini-shopify-backend               # 平滑重启后端
systemctl restart nginx                       # 重启Nginx
systemctl restart mysql                       # 重启MySQL

# === 查看日志 ===
pm2 logs mini-shopify-backend                 # 实时查看应用日志
pm2 logs mini-shopify-backend --lines 100     # 查看最近100行
tail -f /var/log/nginx/error.log              # 查看Nginx错误日志
tail -f /var/log/mini-shopify/error.log       # 查看应用错误日志

# === 部署发布 ===
/var/www/mini-shopify/deploy.sh               # 一键部署
cd /var/www/mini-shopify && git pull          # 拉取最新代码

# === 数据库 ===
mysql -u shopify_qimen -p                     # 登录MySQL
/var/www/mini-shopify/backup.sh               # 手动备份数据库
```

---

**文档版本：** v1.0  
**最后更新：** 2024年
