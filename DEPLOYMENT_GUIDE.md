# Mini-Shopify Antom 阿里云部署指南

> 本文档详细说明如何将 Mini-Shopify Antom 项目部署到阿里云 ECS 服务器。

---

## 一、部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                        阿里云 ECS                            │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │    Nginx     │────▶│  Backend     │     │   MySQL     │  │
│  │   :80/443    │     │  :3001       │     │   :3306     │  │
│  └──────────────┘     └──────────────┘     └─────────────┘  │
│         │                    │                               │
│         │              ┌─────┴─────┐                         │
│         │              │ WebSocket │                         │
│         │              │   :3001   │                         │
│         │              └───────────┘                         │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   Frontend   │  (静态文件由 Nginx 托管)                   │
│  │   静态资源    │                                           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、前置准备

### 2.1 阿里云资源准备

| 资源类型 | 推荐配置 | 说明 |
|---------|---------|------|
| ECS 实例 | 2核4G / CentOS 7.9 或 Ubuntu 20.04 | 最低 1核2G 可用于测试 |
| 公网 IP | 必须配置 | 用于外部访问 |
| 安全组 | 开放 22/80/443 端口 | SSH + HTTP + HTTPS |
| 域名 | 可选 | 用于 HTTPS 证书 |
| SSL 证书 | 可选 | 阿里云免费证书 |

---

### 2.2 如何获取公网 IP

#### 方式一：购买 ECS 时自动分配

1. 登录阿里云控制台：https://ecs.console.aliyun.com
2. 点击「创建实例」
3. 在「网络和安全组」配置页面：
   - **网络类型**：选择「专有网络 VPC」
   - **公网 IP**：勾选「分配公网 IPv4 地址」
   - **带宽计费模式**：按固定带宽或按使用流量
   - **带宽值**：建议 1-5 Mbps（测试用 1M 即可）

4. 创建完成后，实例会自动分配一个公网 IP

#### 方式二：已有实例绑定弹性公网 IP（EIP）

如果 ECS 实例没有公网 IP，可以绑定弹性公网 IP：

1. 进入「弹性公网 IP」控制台：https://vpc.console.aliyun.com/eip
2. 点击「申请弹性公网 IP」
   - **线路类型**：BGP（多线）
   - **带宽值**：根据需求选择
   - **计费方式**：按量付费或包年包月

3. 申请成功后，点击「绑定实例」
4. 选择要绑定的 ECS 实例

#### 查看公网 IP 地址

**控制台查看：**
1. 进入 ECS 控制台 → 实例列表
2. 找到目标实例，查看「公网 IP」列

**命令行查看：**
```bash
# 在 ECS 服务器上执行
curl ifconfig.me
curl ip.sb
curl cip.cc
```

---

### 2.3 如何获取域名

#### 方式一：阿里云购买域名

1. 进入阿里云域名注册页面：https://wanwang.aliyun.com/domain
2. 搜索想要的域名（如 `myshopify.com`）
3. 选择后缀（.com、.cn、.net 等）
4. 加入购物车并完成支付
5. 实名认证（必须，否则无法解析）

**价格参考：**
| 域名后缀 | 首年价格 | 续费价格 |
|---------|---------|---------|
| .com | ¥55 起 | ¥69 起 |
| .cn | ¥29 起 | ¥39 起 |
| .net | ¥69 起 | ¥79 起 |

#### 方式二：使用免费域名

如果只是测试，可以使用免费域名服务：

**Freenom（国外免费域名）：**
- 网址：https://www.freenom.com
- 提供免费 .tk、.ml、.ga、.cf、.gq 域名
- 注意：稳定性较差，不建议生产使用

**Dynv6（免费动态 DNS）：**
- 网址：https://dynv6.com
- 提供免费子域名

#### 域名实名认证

购买域名后必须完成实名认证：

1. 进入「域名控制台」：https://dc.console.aliyun.com
2. 点击「未实名认证」
3. 上传证件照片（个人身份证或企业营业执照）
4. 等待审核（通常 1-3 个工作日）

---

### 2.4 域名解析配置

#### 步骤一：添加解析记录

1. 进入「云解析 DNS」控制台：https://dns.console.aliyun.com
2. 找到已购买的域名，点击「解析设置」
3. 点击「添加记录」，配置如下：

| 记录类型 | 主机记录 | 记录值 | TTL | 说明 |
|---------|---------|--------|-----|------|
| A | @ | 你的公网IP | 600 | 主域名指向服务器 |
| A | www | 你的公网IP | 600 | www 子域名 |
| A | api | 你的公网IP | 600 | API 子域名（可选） |

**示例：**
```
记录类型: A
主机记录: @
记录值: 123.45.67.89  （替换为你的公网 IP）
TTL: 600
```

#### 步骤二：验证解析生效

```bash
# Windows
nslookup your-domain.com

# Mac/Linux
dig your-domain.com
ping your-domain.com
```

解析生效时间：通常 10 分钟 - 2 小时

---

### 2.5 无域名时的替代方案

如果没有域名，可以直接使用公网 IP 访问：

**访问地址：**
- 前端：`http://你的公网IP`
- API：`http://你的公网IP/api`
- WebSocket：`ws://你的公网IP/ws`

**修改前端配置：**
```bash
# packages/frontend/.env.production
VITE_API_BASE_URL=http://你的公网IP/api
VITE_WS_URL=ws://你的公网IP/ws
```

**修改后端配置：**
```bash
# packages/backend/.env.production
NOTIFY_CALLBACK_URL=http://你的公网IP/api/notify/register
```

**注意：**
- 无域名无法使用 HTTPS
- Antom 回调 URL 可能要求 HTTPS（需确认）
- IP 地址变更后需要重新配置

---

### 2.6 ECS 镜像选择

#### 推荐镜像

| 操作系统 | 版本推荐 | 适用场景 |
|---------|---------|---------|
| **Ubuntu** | 20.04 LTS 或 22.04 LTS | ⭐ 推荐，软件包新，社区文档丰富 |
| **CentOS** | 7.9 或 8.x | 企业常用，稳定性好 |
| **Alibaba Cloud Linux** | 3.x | 阿里云优化版，免费，性能好 |

#### 选择建议

**推荐 Ubuntu 22.04 LTS：**
- Node.js 兼容性好
- 软件包更新及时
- 社区文档和教程丰富
- LTS 版本支持到 2027 年

**备选 Alibaba Cloud Linux 3：**
- 阿里云官方优化
- 免费使用
- 与 CentOS 兼容
- 性能优化更好

#### 镜像配置步骤

1. 在 ECS 创建页面，找到「镜像」配置区域
2. 选择「公共镜像」
3. 选择操作系统和版本：
   - **Ubuntu**：选择 `Ubuntu 22.04 64位`
   - **CentOS**：选择 `CentOS 7.9 64位`
   - **Alibaba Cloud Linux**：选择 `Alibaba Cloud Linux 3.2104 64位`

#### 不同系统的命令差异

| 操作 | Ubuntu/Debian | CentOS/RHEL |
|------|---------------|-------------|
| 包管理器 | `apt` | `yum` |
| 安装软件 | `apt install` | `yum install` |
| 更新索引 | `apt update` | `yum makecache` |
| MySQL 服务名 | `mysql` | `mysqld` |

**Ubuntu 示例：**
```bash
apt update
apt install -y nginx mysql-server
systemctl start mysql
```

**CentOS 示例：**
```bash
yum makecache
yum install -y nginx mysql-server
systemctl start mysqld
```

---

### 2.7 本地准备

确保本地已安装：
- Node.js >= 18.x
- npm 或 yarn
- Git

---

## 三、服务器环境配置

### 3.1 连接服务器

```bash
ssh root@your_server_ip
```

### 3.2 安装 Node.js (推荐使用 nvm)

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# 安装 Node.js 18.x
nvm install 18
nvm use 18
nvm alias default 18

# 验证安装
node -v
npm -v
```

### 3.3 安装 PM2 (进程管理)

```bash
npm install -g pm2

# 设置开机自启
pm2 startup
```

### 3.4 安装 Nginx

**CentOS:**
```bash
yum install -y epel-release
yum install -y nginx
```

**Ubuntu:**
```bash
apt update
apt install -y nginx
```

### 3.5 安装 MySQL (推荐替代 SQLite)

**CentOS:**
```bash
# 添加 MySQL 仓库
yum localinstall -y https://dev.mysql.com/get/mysql80-community-release-el7-3.noarch.rpm
yum install -y mysql-community-server

# 启动 MySQL
systemctl start mysqld
systemctl enable mysqld

# 获取临时密码
grep 'temporary password' /var/log/mysqld.log

# 安全配置
mysql_secure_installation
```

**Ubuntu:**
```bash
apt install -y mysql-server
systemctl start mysql
systemctl enable mysql
mysql_secure_installation
```

### 3.6 创建数据库和用户

```bash
mysql -u root -p
```

```sql
-- 创建数据库
CREATE DATABASE mini_shopify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER 'shopify_user'@'localhost' IDENTIFIED BY 'YourStrongPassword123!';

-- 授权
GRANT ALL PRIVILEGES ON mini_shopify.* TO 'shopify_user'@'localhost';
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

---

## 四、项目部署

### 4.1 创建部署目录

```bash
mkdir -p /var/www/mini-shopify
cd /var/www/mini-shopify
```

### 4.2 上传项目代码

**方式一：Git 克隆（推荐）**

```bash
git clone https://your-repo-url.git .
```

**方式二：SCP 上传**

本地执行：
```bash
# 排除 node_modules 后打包
tar --exclude='node_modules' --exclude='.git' -czvf mini-shopify.tar.gz /path/to/mini-shopify-qimen

# 上传到服务器
scp mini-shopify.tar.gz root@your_server_ip:/var/www/mini-shopify/
```

服务器执行：
```bash
cd /var/www/mini-shopify
tar -xzvf mini-shopify.tar.gz --strip-components=1
```

### 4.3 后端配置

```bash
cd /var/www/mini-shopify/packages/backend
```

**创建生产环境配置文件：**

```bash
cat > .env.production << 'EOF'
# 服务端口
PORT=3001

# 数据库 (MySQL)
DATABASE_URL=mysql://shopify_user:YourStrongPassword123!@localhost:3306/mini_shopify

# Antom 配置
ANTOM_CLIENT_ID=your_client_id
ANTOM_PRIVATE_KEY=your_private_key_content
ANTOM_PUBLIC_KEY=antom_public_key_content
ANTOM_BASE_URL=https://open-sea-global.alipay.com
ANTOM_AGENT_TOKEN=your_agent_token
PARENT_MERCHANT_ID=2188120041577055
DEFAULT_SETTLEMENT_CURRENCY=SGD

# 生产模式
MOCK_MODE=false
MOCK_NOTIFY_DELAY_MS=1500
NOTIFY_CALLBACK_URL=https://your-domain.com/api/notify/register

# 安全配置
NODE_ENV=production
EOF
```

**修改 Prisma 配置支持 MySQL：**

编辑 `packages/backend/prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// 其余模型保持不变，但需要添加 @@index 和 @@fulltext 索引
```

**安装依赖和构建：**

```bash
cd /var/www/mini-shopify/packages/backend

# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate deploy

# 构建项目
npm run build
```

### 4.4 前端配置和构建

```bash
cd /var/www/mini-shopify/packages/frontend
```

**创建环境配置：**

```bash
cat > .env.production << 'EOF'
VITE_API_BASE_URL=https://your-domain.com/api
VITE_WS_URL=wss://your-domain.com/ws
EOF
```

**修改 vite.config.ts 添加生产配置：**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
```

**安装依赖和构建：**

```bash
# 安装依赖
npm install

# 构建生产版本
npm run build

# 创建静态文件目录
mkdir -p /var/www/mini-shopify/frontend-dist

# 复制构建产物
cp -r dist/* /var/www/mini-shopify/frontend-dist/
```

---

## 五、PM2 进程管理

### 5.1 创建 PM2 配置文件

```bash
cd /var/www/mini-shopify

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'mini-shopify-backend',
      cwd: '/var/www/mini-shopify/packages/backend',
      script: 'dist/app.js',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/mini-shopify/error.log',
      out_file: '/var/log/mini-shopify/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    }
  ]
};
EOF
```

### 5.2 创建日志目录

```bash
mkdir -p /var/log/mini-shopify
```

### 5.3 启动应用

```bash
cd /var/www/mini-shopify

# 启动
pm2 start ecosystem.config.js --env production

# 查看状态
pm2 status

# 查看日志
pm2 logs mini-shopify-backend

# 保存进程列表
pm2 save
```

---

## 六、Nginx 配置

### 6.1 创建 Nginx 配置文件

```bash
cat > /etc/nginx/conf.d/mini-shopify.conf << 'EOF'
# 后端上游
upstream backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

# HTTP 重定向到 HTTPS (可选)
server {
    listen 80;
    server_name your-domain.com;
    
    # 如果不需要 HTTPS，注释掉下面这行
    # return 301 https://$server_name$request_uri;
    
    # 不使用 HTTPS 时的配置
    root /var/www/mini-shopify/frontend-dist;
    index index.html;

    # 前端静态资源
    location / {
        try_files $uri $uri/ /index.html;
        
        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 代理
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 超时设置
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
    gzip_comp_level 6;
}

# HTTPS 配置 (可选 - 需要SSL证书)
# server {
#     listen 443 ssl http2;
#     server_name your-domain.com;
#
#     # SSL 证书 (阿里云免费证书)
#     ssl_certificate /etc/nginx/ssl/your-domain.com.pem;
#     ssl_certificate_key /etc/nginx/ssl/your-domain.com.key;
#
#     # SSL 配置
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#     ssl_session_cache shared:SSL:10m;
#     ssl_session_timeout 10m;
#
#     # HSTS
#     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
#
#     root /var/www/mini-shopify/frontend-dist;
#     index index.html;
#
#     # 前端静态资源
#     location / {
#         try_files $uri $uri/ /index.html;
#         
#         location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
#             expires 1y;
#             add_header Cache-Control "public, immutable";
#         }
#     }
#
#     # API 代理
#     location /api {
#         proxy_pass http://backend;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#     }
#
#     # WebSocket 代理
#     location /ws {
#         proxy_pass http://backend;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection "upgrade";
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_connect_timeout 7d;
#         proxy_send_timeout 7d;
#         proxy_read_timeout 7d;
#     }
#
#     # Gzip
#     gzip on;
#     gzip_vary on;
#     gzip_min_length 1024;
#     gzip_proxied any;
#     gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
#     gzip_comp_level 6;
# }
EOF
```

### 6.2 测试并重启 Nginx

```bash
# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx

# 设置开机自启
systemctl enable nginx
```

---

## 七、阿里云安全组配置

### 7.1 入站规则

在阿里云控制台 → ECS 实例 → 安全组 → 配置规则：

| 端口范围 | 授权对象 | 协议 | 说明 |
|---------|---------|------|------|
| 22 | 0.0.0.0/0 或指定 IP | TCP | SSH |
| 80 | 0.0.0.0/0 | TCP | HTTP |
| 443 | 0.0.0.0/0 | TCP | HTTPS |
| 3306 | 127.0.0.1 或内网 IP | TCP | MySQL (仅内网) |

### 7.2 出站规则

默认允许所有出站流量。

---

## 八、SSL 证书配置（可选）

### 8.1 申请阿里云免费证书

1. 登录阿里云控制台
2. 进入「SSL 证书（应用安全）」
3. 购买免费证书（DV 单域名）
4. 填写域名信息并验证
5. 下载 Nginx 格式证书

### 8.2 安装证书

```bash
# 创建证书目录
mkdir -p /etc/nginx/ssl

# 上传证书文件
# 本地执行：
scp your-domain.com.pem root@your_server_ip:/etc/nginx/ssl/
scp your-domain.com.key root@your_server_ip:/etc/nginx/ssl/

# 设置权限
chmod 600 /etc/nginx/ssl/*

# 启用 HTTPS 配置
# 编辑 /etc/nginx/conf.d/mini-shopify.conf
# 取消 HTTPS server 块的注释

# 重启 Nginx
systemctl restart nginx
```

---

## 九、部署验证

### 9.1 检查服务状态

```bash
# 检查 PM2 进程
pm2 status

# 检查端口监听
netstat -tlnp | grep -E '3001|80|443|3306'

# 检查 Nginx 状态
systemctl status nginx

# 检查 MySQL 状态
systemctl status mysqld  # CentOS
systemctl status mysql   # Ubuntu
```

### 9.2 测试访问

```bash
# 测试前端
curl http://localhost

# 测试 API
curl http://localhost:3001/api/config

# 测试数据库连接
mysql -u shopify_user -p mini_shopify -e "SHOW TABLES;"
```

### 9.3 查看日志

```bash
# PM2 日志
pm2 logs mini-shopify-backend

# Nginx 访问日志
tail -f /var/log/nginx/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log

# 应用日志
tail -f /var/log/mini-shopify/out.log
tail -f /var/log/mini-shopify/error.log
```

---

## 十、更新部署

### 10.1 手动更新

```bash
cd /var/www/mini-shopify

# 拉取最新代码
git pull origin main

# 更新后端
cd packages/backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

# 更新前端
cd ../frontend
npm install
npm run build
cp -r dist/* /var/www/mini-shopify/frontend-dist/

# 重启后端
pm2 restart mini-shopify-backend
```

### 10.2 创建更新脚本

```bash
cat > /var/www/mini-shopify/deploy.sh << 'EOF'
#!/bin/bash
set -e

PROJECT_DIR="/var/www/mini-shopify"
BACKEND_DIR="$PROJECT_DIR/packages/backend"
FRONTEND_DIR="$PROJECT_DIR/packages/frontend"

echo "=== 开始部署 ==="

# 拉取代码
cd $PROJECT_DIR
git pull origin main

# 更新后端
echo "更新后端..."
cd $BACKEND_DIR
npm install --production=false
npx prisma generate
npx prisma migrate deploy
npm run build

# 更新前端
echo "更新前端..."
cd $FRONTEND_DIR
npm install
npm run build
cp -r dist/* $PROJECT_DIR/frontend-dist/

# 重启服务
echo "重启服务..."
pm2 restart mini-shopify-backend

echo "=== 部署完成 ==="
EOF

chmod +x /var/www/mini-shopify/deploy.sh
```

---

## 十一、备份策略

### 11.1 数据库备份

```bash
# 创建备份目录
mkdir -p /var/backups/mysql

# 创建备份脚本
cat > /var/www/mini-shopify/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="mini_shopify"
DB_USER="shopify_user"
DB_PASS="YourStrongPassword123!"

# 创建备份
mysqldump -u$DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${DB_NAME}_${DATE}.sql.gz"
EOF

chmod +x /var/www/mini-shopify/backup.sh
```

### 11.2 设置定时备份

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点备份
0 2 * * * /var/www/mini-shopify/backup.sh >> /var/log/mini-shopify/backup.log 2>&1
```

---

## 十二、监控告警

### 12.1 PM2 监控

```bash
# 安装 pm2-logrotate
pm2 install pm2-logrotate

# 设置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 12.2 阿里云监控

在阿里云控制台启用：
- 云监控：CPU、内存、磁盘监控
- 日志服务：应用日志收集
- 云安全中心：安全防护

---

## 十三、常见问题

### Q1: 502 Bad Gateway

**原因**: 后端服务未启动或端口不通

**解决**:
```bash
# 检查后端服务
pm2 status
pm2 logs mini-shopify-backend

# 检查端口
netstat -tlnp | grep 3001
```

### Q2: WebSocket 连接失败

**原因**: Nginx WebSocket 代理配置错误

**解决**: 确保 Nginx 配置包含：
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Q3: 数据库连接失败

**原因**: 密码错误或权限问题

**解决**:
```bash
# 测试连接
mysql -u shopify_user -p mini_shopify

# 检查权限
mysql -u root -p
SHOW GRANTS FOR 'shopify_user'@'localhost';
```

### Q4: 前端页面空白

**原因**: 路由配置问题

**解决**: 确保 Nginx 配置包含：
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Q5: Antom 回调未收到

**原因**: 回调 URL 配置错误或防火墙阻止

**解决**:
1. 确认 `NOTIFY_CALLBACK_URL` 配置正确
2. 确认安全组开放 443/80 端口
3. 检查 Nginx 访问日志

---

## 十四、性能优化建议

### 14.1 后端优化

- 启用 PM2 集群模式（已配置）
- 开启 Gzip 压缩（Nginx 已配置）
- 数据库连接池优化

### 14.2 前端优化

- 静态资源 CDN 加速
- 开启浏览器缓存（已配置）
- 代码分割和懒加载

### 14.3 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_merchant_status ON Merchant(status);
CREATE INDEX idx_merchant_kyc_status ON Merchant(kycStatus);
CREATE INDEX idx_notification_type ON Notification(notificationType);
```

---

## 十五、安全加固

### 15.1 服务器安全

```bash
# 禁用 root 密码登录
vim /etc/ssh/sshd_config
# PermitRootLogin prohibit-password
# PasswordAuthentication no

# 重启 SSH
systemctl restart sshd

# 安装 fail2ban
yum install -y fail2ban  # CentOS
apt install -y fail2ban  # Ubuntu

# 配置 fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/secure
maxretry = 3
bantime = 3600
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

### 15.2 应用安全

- 环境变量文件权限设置为 600
- 定期更新依赖包
- 启用 HTTPS
- 配置 CORS 白名单

---

## 十六、快速部署清单

```bash
# 1. 安装环境
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18 && nvm use 18 && nvm alias default 18
npm install -g pm2
yum install -y nginx mysql-server  # CentOS

# 2. 配置数据库
mysql -u root -p
CREATE DATABASE mini_shopify CHARACTER SET utf8mb4;
CREATE USER 'shopify_user'@'localhost' IDENTIFIED BY 'YourPassword';
GRANT ALL ON mini_shopify.* TO 'shopify_user'@'localhost';
FLUSH PRIVILEGES;

# 3. 部署代码
cd /var/www/mini-shopify
git clone your-repo .

# 4. 配置后端
cd packages/backend
cp .env.example .env.production
# 编辑 .env.production
npm install && npx prisma generate && npx prisma migrate deploy && npm run build

# 5. 构建前端
cd ../frontend
npm install && npm run build
mkdir -p /var/www/mini-shopify/frontend-dist
cp -r dist/* /var/www/mini-shopify/frontend-dist/

# 6. 配置 Nginx
# 复制上面的 Nginx 配置到 /etc/nginx/conf.d/mini-shopify.conf
nginx -t && systemctl restart nginx

# 7. 启动应用
pm2 start ecosystem.config.js --env production
pm2 save

# 8. 验证
curl http://localhost
curl http://localhost:3001/api/config
```

---

*文档生成时间: 2026-04-02*