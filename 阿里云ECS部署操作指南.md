# Mini-Shopify 阿里云ECS部署操作指南

> 本指南针对已购买阿里云ECS服务器的用户，提供从0到1的完整部署操作步骤。

---

## 目录

1. [准备工作](#一准备工作)
2. [连接服务器](#二连接服务器)
3. [环境安装](#三环境安装)
4. [项目部署](#四项目部署)
5. [配置Nginx](#五配置nginx)
6. [配置安全组](#六配置安全组)
7. [验证部署](#七验证部署)
8. [常见问题](#八常见问题)

---

## 一、准备工作

### 1.1 获取服务器信息

登录阿里云控制台，记录以下信息：

| 信息项 | 获取位置 | 用途 |
|--------|---------|------|
| **公网IP** | ECS控制台 → 实例列表 → 公网IP | SSH连接、访问应用 |
| **登录密码** | 购买时设置的密码 | SSH登录 |
| **操作系统** | 实例详情 → 镜像信息 | 确定安装命令 |

### 1.2 本地准备

确保本地已安装：
- SSH客户端（Mac/Linux自带，Windows可用PowerShell或Git Bash）
- 项目代码（从Git仓库克隆或本地打包）

---

## 二、连接服务器

### 2.1 SSH登录

```bash
# 替换为你的公网IP
ssh root@你的公网IP

# 示例
ssh root@123.45.67.89
```

首次连接会提示确认，输入 `yes` 后回车，然后输入密码。

### 2.2 验证服务器环境

```bash
# 查看系统版本
cat /etc/os-release

# 查看内存
free -h

# 查看磁盘空间
df -h

# 查看当前IP
curl ifconfig.me
```

---

## 三、环境安装

### 3.1 更新系统包

**Ubuntu/Debian系统：**
```bash
apt update && apt upgrade -y
```

**CentOS/Alibaba Cloud Linux系统：**
```bash
yum update -y
```

### 3.2 安装Node.js

```bash
# 安装nvm（Node版本管理器）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 使nvm生效
source ~/.bashrc

# 安装Node.js 18.x
nvm install 18
nvm use 18
nvm alias default 18

# 验证安装
node -v  # 应显示 v18.x.x
npm -v   # 应显示 9.x.x或10.x.x
```

### 3.3 安装PM2（进程管理器）

```bash
npm install -g pm2

# 设置PM2开机自启
pm2 startup
```

### 3.4 安装Nginx

**Ubuntu/Debian：**
```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

**CentOS/Alibaba Cloud Linux：**
```bash
yum install -y epel-release
yum install -y nginx
systemctl start nginx
systemctl enable nginx
```

### 3.5 安装MySQL

**Ubuntu/Debian：**
```bash
apt install -y mysql-server
systemctl start mysql
systemctl enable mysql

# 安全配置
mysql_secure_installation
```

**CentOS/Alibaba Cloud Linux：**
```bash
# 安装MySQL 8.0
yum localinstall -y https://dev.mysql.com/get/mysql80-community-release-el7-11.noarch.rpm
yum install -y mysql-community-server

systemctl start mysqld
systemctl enable mysqld

# 获取临时密码
grep 'temporary password' /var/log/mysqld.log

# 安全配置
mysql_secure_installation
```

### 3.6 创建数据库

```bash
# 登录MySQL
mysql -u root -p
```

在MySQL命令行中执行：

```sql
-- 创建数据库
CREATE DATABASE mini_shopify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（将YourPassword替换为强密码）
CREATE USER 'shopify_user'@'localhost' IDENTIFIED BY 'YourPassword123!';

-- 授权
GRANT ALL PRIVILEGES ON mini_shopify.* TO 'shopify_user'@'localhost';
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

### 3.7 安装Git

```bash
# Ubuntu/Debian
apt install -y git

# CentOS/Alibaba Cloud Linux
yum install -y git
```

---

## 四、项目部署

### 4.1 创建项目目录

```bash
mkdir -p /var/www/mini-shopify
cd /var/www/mini-shopify
```

### 4.2 上传项目代码

**方式一：Git克隆（推荐）**

如果你已经将代码推送到GitHub/GitLab等代码仓库：

```bash
# 在项目目录中克隆代码
cd /var/www/mini-shopify

# 方式A：HTTPS方式（需要输入用户名密码或使用个人访问令牌）
git clone https://github.com/your-username/mini-shopify.git .

# 方式B：SSH方式（需要配置SSH密钥）
git clone git@github.com:your-username/mini-shopify.git .
```

**Git配置详解：**

#### 1) 配置Git用户信息（首次使用）

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### 2) HTTPS方式克隆（简单）

```bash
# 直接克隆，会提示输入用户名和密码
git clone https://github.com/your-username/mini-shopify.git /var/www/mini-shopify

# 或使用个人访问令牌（推荐）
# 在GitHub Settings → Developer settings → Personal access tokens 生成令牌
git clone https://YOUR_TOKEN@github.com/your-username/mini-shopify.git /var/www/mini-shopify
```

#### 3) SSH方式克隆（更安全）

```bash
# 生成SSH密钥
ssh-keygen -t ed25519 -C "your.email@example.com"

# 查看并复制公钥
cat ~/.ssh/id_ed25519.pub

# 将公钥添加到GitHub/GitLab的SSH Keys设置中
# GitHub路径：Settings → SSH and GPG keys → New SSH key

# 测试SSH连接
ssh -T git@github.com

# 克隆仓库
git clone git@github.com:your-username/mini-shopify.git /var/www/mini-shopify
```

#### 4) 如果代码在本地未推送

**本地执行：**
```bash
# 进入本地项目目录
cd /path/to/mini-shopify

# 初始化Git仓库（如果还没有）
git init

# 添加远程仓库
git remote add origin https://github.com/your-username/mini-shopify.git

# 提交代码
git add .
git commit -m "Initial commit"

# 推送到远程
git push -u origin main
```

**方式二：本地打包上传**

本地执行：
```bash
# 在项目根目录执行，排除node_modules
tar --exclude='node_modules' --exclude='.git' -czvf mini-shopify.tar.gz .

# 上传到服务器（替换为你的公网IP）
scp mini-shopify.tar.gz root@你的公网IP:/var/www/mini-shopify/
```

服务器执行：
```bash
cd /var/www/mini-shopify
tar -xzvf mini-shopify.tar.gz
```

### 4.3 部署后端

```bash
cd /var/www/mini-shopify/packages/backend
```

#### 4.3.1 创建生产环境配置

```bash
cat > .env.production << 'EOF'
# 服务端口
PORT=3001

# 数据库配置（将YourPassword替换为你设置的密码）
DATABASE_URL=mysql://shopify_user:YourPassword123!@localhost:3306/mini_shopify

# Antom配置（需要填写实际值）
ANTOM_CLIENT_ID=your_client_id
ANTOM_PRIVATE_KEY=your_private_key
ANTOM_PUBLIC_KEY=antom_public_key
ANTOM_BASE_URL=https://open-sea-global.alipay.com
ANTOM_AGENT_TOKEN=your_agent_token
PARENT_MERCHANT_ID=2188120041577055
DEFAULT_SETTLEMENT_CURRENCY=SGD

# 生产模式
MOCK_MODE=false
MOCK_NOTIFY_DELAY_MS=1500
NOTIFY_CALLBACK_URL=http://你的公网IP/api/notify/register

# 环境
NODE_ENV=production
EOF
```

#### 4.3.2 修改Prisma配置（SQLite改为MySQL）

编辑 `prisma/schema.prisma`：

```bash
# 备份原文件
cp prisma/schema.prisma prisma/schema.prisma.backup

# 修改数据库配置
cat > prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Merchant {
  id                    String   @id @default(uuid())
  shopName              String
  region                String   @default("CN")
  email                 String
  wfAccountId           String?
  referenceMerchantId   String?  @unique
  kycStatus             String   @default("PENDING")
  riskLevel             String?
  riskReasonCodes       String?
  registrationRequestId String?
  offboardingRequestId  String?
  settlementCurrency    String   @default("SGD")
  status                String   @default("ACTIVE")
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  kycInfo              KycInfo?
  paymentMethods       PaymentMethod[]
  notifications        Notification[]
  entityAssociations   EntityAssociation[]

  @@index([email])
  @@index([status])
  @@index([kycStatus])
}

model KycInfo {
  id              String   @id @default(uuid())
  merchantId      String   @unique
  merchant        Merchant @relation(fields: [merchantId], references: [id])
  legalName       String?
  companyType     String?
  certificateType String?
  certificateNo   String?
  branchName      String?
  companyUnit     String?
  addressRegion   String?
  addressState    String?
  addressCity     String?
  address1        String?
  address2        String?
  zipCode         String?
  mcc             String?
  doingBusinessAs String?
  websiteUrl      String?
  englishName     String?
  serviceDescription String?
  appName         String?
  merchantBrandName String?
  contactType     String?
  contactInfo     String?
  legalRepName    String?
  legalRepIdType  String?
  legalRepIdNo    String?
  legalRepDob     String?
  wfKycData       String?  @db.Text
  rejectedFields  String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model EntityAssociation {
  id                String   @id @default(uuid())
  merchantId        String
  merchant          Merchant @relation(fields: [merchantId], references: [id])
  associationType   String
  shareholdingRatio String?
  fullName          String?
  firstName         String?
  lastName          String?
  dateOfBirth       String?
  idType            String?
  idNo              String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([merchantId])
}

model PaymentMethod {
  id                String   @id @default(uuid())
  merchantId        String
  merchant          Merchant @relation(fields: [merchantId], references: [id])
  paymentMethodType String
  status            String   @default("PENDING")
  activatedAt       DateTime?
  deactivatedAt     DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([merchantId])
}

model Notification {
  id               String   @id @default(uuid())
  merchantId       String
  merchant         Merchant @relation(fields: [merchantId], references: [id])
  notifyId         String   @unique
  notificationType String
  payload          String   @db.Text
  processedAt      DateTime @default(now())

  @@index([merchantId])
}
EOF
```

#### 4.3.3 安装依赖并构建

```bash
# 安装依赖
npm install

# 安装MySQL驱动
npm install mysql2

# 生成Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate deploy

# 构建项目
npm run build
```

### 4.4 部署前端

```bash
cd /var/www/mini-shopify/packages/frontend
```

#### 4.4.1 创建生产环境配置

```bash
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://你的公网IP/api
VITE_WS_URL=ws://你的公网IP/ws
EOF
```

#### 4.4.2 安装依赖并构建

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

### 4.5 配置PM2启动

```bash
cd /var/www/mini-shopify

# 创建PM2配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'mini-shopify-backend',
      cwd: '/var/www/mini-shopify/packages/backend',
      script: 'dist/app.js',
      instances: 1,
      exec_mode: 'fork',
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

# 创建日志目录
mkdir -p /var/log/mini-shopify

# 启动应用
pm2 start ecosystem.config.js --env production

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
```

---

## 五、配置Nginx

### 5.1 创建Nginx配置文件

```bash
cat > /etc/nginx/conf.d/mini-shopify.conf << 'EOF'
# 后端上游
upstream backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    server_name _;  # 接受所有域名/IP访问
    
    # 前端静态资源
    root /var/www/mini-shopify/frontend-dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        
        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API代理
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
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket代理
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
    gzip_comp_level 6;
}
EOF
```

### 5.2 测试并重启Nginx

```bash
# 测试配置是否正确
nginx -t

# 重启Nginx
systemctl restart nginx

# 查看Nginx状态
systemctl status nginx
```

---

## 六、配置安全组

### 6.1 开放端口

登录阿里云控制台 → ECS → 安全组 → 配置规则，添加以下入方向规则：

| 端口范围 | 授权对象 | 协议 | 说明 |
|---------|---------|------|------|
| 22 | 0.0.0.0/0 | TCP | SSH登录（建议后期限制为本地IP） |
| 80 | 0.0.0.0/0 | TCP | HTTP访问 |
| 443 | 0.0.0.0/0 | TCP | HTTPS访问（可选） |

**操作步骤：**
1. 进入ECS控制台 → 实例列表
2. 点击目标实例 → 安全组
3. 点击「配置规则」
4. 点击「手动添加」，添加上述规则

### 6.2 验证端口开放

```bash
# 在服务器上查看端口监听
netstat -tlnp

# 或
ss -tlnp
```

---

## 七、验证部署

### 7.1 检查服务状态

```bash
# 检查PM2进程
pm2 status

# 检查端口监听
netstat -tlnp | grep -E '3001|80|3306'

# 检查Nginx
systemctl status nginx

# 检查MySQL
systemctl status mysql  # Ubuntu
# 或
systemctl status mysqld  # CentOS
```

### 7.2 本地测试

```bash
# 测试前端
curl http://localhost

# 测试API
curl http://localhost:3001/api/config

# 测试数据库
mysql -u shopify_user -p -e "SHOW DATABASES;"
```

### 7.3 公网访问测试

在浏览器中访问：
- 前端页面：`http://你的公网IP`
- API测试：`http://你的公网IP/api/config`

---

## 八、常见问题

### Q1: 无法连接SSH

**可能原因：**
- 安全组未开放22端口
- 密码错误
- 网络不通

**解决：**
```bash
# 在阿里云控制台使用VNC登录检查
# 检查SSH服务
systemctl status sshd  # CentOS
systemctl status ssh   # Ubuntu

# 重启SSH服务
systemctl restart sshd
```

### Q2: 502 Bad Gateway

**可能原因：**
- 后端服务未启动
- 端口不匹配

**解决：**
```bash
# 检查后端服务
pm2 status
pm2 logs mini-shopify-backend

# 检查端口
netstat -tlnp | grep 3001

# 重启后端
pm2 restart mini-shopify-backend
```

### Q3: 前端页面空白

**可能原因：**
- 静态文件路径错误
- 构建失败

**解决：**
```bash
# 检查静态文件
cd /var/www/mini-shopify/frontend-dist
ls -la

# 重新构建前端
cd /var/www/mini-shopify/packages/frontend
npm run build
cp -r dist/* /var/www/mini-shopify/frontend-dist/

# 重启Nginx
systemctl restart nginx
```

### Q4: 数据库连接失败

**可能原因：**
- MySQL未启动
- 用户名密码错误
- 数据库未创建

**解决：**
```bash
# 检查MySQL状态
systemctl status mysql

# 测试连接
mysql -u shopify_user -p -e "SELECT 1;"

# 查看错误日志
tail -f /var/log/mysql/error.log
```

### Q5: 公网无法访问

**可能原因：**
- 安全组未开放80端口
- Nginx未启动
- 防火墙阻挡

**解决：**
```bash
# 检查防火墙
ufw status  # Ubuntu
firewall-cmd --state  # CentOS

# 关闭防火墙（测试用）
ufw disable  # Ubuntu
systemctl stop firewalld  # CentOS

# 检查Nginx配置
nginx -t
systemctl restart nginx
```

---

## 九、后续操作

### 9.1 配置域名（可选）

1. 购买域名并解析到ECS公网IP
2. 申请SSL证书
3. 配置Nginx HTTPS

### 9.2 配置自动部署脚本

```bash
cat > /var/www/mini-shopify/deploy.sh << 'EOF'
#!/bin/bash
set -e

cd /var/www/mini-shopify

echo "=== 开始更新 ==="

# 拉取代码
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

# 重启服务
pm2 restart mini-shopify-backend

echo "=== 更新完成 ==="
EOF

chmod +x /var/www/mini-shopify/deploy.sh
```

### 9.3 配置数据库备份

```bash
cat > /var/www/mini-shopify/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="mini_shopify"
DB_USER="shopify_user"
DB_PASS="YourPassword123!"

mkdir -p $BACKUP_DIR

# 创建备份
mysqldump -u$DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz

# 删除7天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "备份完成: ${DB_NAME}_${DATE}.sql.gz"
EOF

chmod +x /var/www/mini-shopify/backup.sh

# 添加定时任务（每天凌晨2点备份）
crontab -e
# 添加: 0 2 * * * /var/www/mini-shopify/backup.sh
```

---

## 快速命令参考

```bash
# 查看服务状态
pm2 status
systemctl status nginx
systemctl status mysql

# 查看日志
pm2 logs
journalctl -u nginx -f
tail -f /var/log/mini-shopify/error.log

# 重启服务
pm2 restart mini-shopify-backend
systemctl restart nginx

# 更新部署
/var/www/mini-shopify/deploy.sh
```

---

**部署完成！** 现在可以通过 `http://你的公网IP` 访问你的Mini-Shopify应用了。
