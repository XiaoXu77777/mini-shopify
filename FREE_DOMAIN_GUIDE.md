# 免费域名申请与解析配置指南

> 本文档指导如何申请免费域名并绑定到公网 IP：47.116.222.5

---

## 一、免费域名申请方式

### 方式一：阿里云免费域名（推荐）

阿里云本身不提供免费域名，但新用户有优惠活动：

1. 访问：https://wanwang.aliyun.com/domain
2. 查看新用户优惠（.top、.xyz 等 1 元/年）
3. 购买后可正常解析

---

### 方式二：Freenom 免费域名（国外）

**网址：** https://www.freenom.com

**可申请的免费域名后缀：**
- .tk
- .ml
- .ga
- .cf
- .gq

**申请步骤：**

#### 步骤 1：访问 Freenom

```
https://www.freenom.com
```

#### 步骤 2：搜索域名

1. 在搜索框输入想要的域名（如 `mini-shopify`）
2. 点击「Check Availability」

#### 步骤 3：选择免费域名

1. 搜索结果中找到标记「Free」的域名
2. 勾选想要的域名（如 `mini-shopify.tk`）
3. 点击「Get it now!」

#### 步骤 4：注册账号

1. 点击「Checkout」
2. 选择「Use DNS」→「Your own DNS」
3. 填写 DNS 服务器（可先跳过，后续配置）
4. 填写注册信息：
   - Email：你的邮箱
   - 验证邮箱后设置密码

#### 步骤 5：完成注册

1. 邮箱验证
2. 登录 Freenom 控制台

**注意：** Freenom 免费域名稳定性较差，不建议生产环境使用。

---

### 方式三：DuckDNS 免费动态 DNS（推荐测试用）

**网址：** https://www.duckdns.org

**特点：**
- 完全免费
- 无需注册，支持 GitHub/Google/Twitter 登录
- 提供 `xxx.duckdns.org` 子域名

**申请步骤：**

#### 步骤 1：访问 DuckDNS

```
https://www.duckdns.org
```

#### 步骤 2：登录

选择以下方式之一登录：
- GitHub
- Google
- Twitter

#### 步骤 3：创建域名

1. 在「subdomain」输入框输入想要的子域名（如 `minishopify`）
2. 在「current ip」输入框输入：`47.116.222.5`
3. 点击「add domain」

#### 步骤 4：完成

你的域名将是：`minishopify.duckdns.org`

---

### 方式四：EU.ORG 免费域名

**网址：** https://nic.eu.org

**特点：**
- 提供免费 `xxx.eu.org` 子域名
- 审核时间较长（几天到几周）

**申请步骤：**

#### 步骤 1：访问 EU.ORG

```
https://nic.eu.org
```

#### 步骤 2：注册账号

1. 点击「New Registration」
2. 填写邮箱和密码
3. 验证邮箱

#### 步骤 3：申请域名

1. 登录后点击「New Domain」
2. 输入域名（如 `mini-shopify.eu.org`）
3. 填写 DNS 服务器或 IP 地址
4. 提交等待审核

---

### 方式五：Js.org 免费域名（适合前端项目）

**网址：** https://js.org

**特点：**
- 提供免费 `xxx.js.org` 子域名
- 适合前端项目
- 需要 GitHub 仓库

**申请步骤：**

1. Fork js.org 仓库
2. 修改 `cnames_active.js` 文件
3. 添加你的域名配置
4. 提交 Pull Request

---

## 二、推荐方案

### 测试环境推荐：DuckDNS

**优势：**
- 完全免费
- 即时生效
- 无需备案
- 配置简单

**你的域名：** `minishopify.duckdns.org`（或其他你选择的名称）

### 生产环境推荐：阿里云购买域名

**优势：**
- 稳定可靠
- 国内解析速度快
- 支持 HTTPS
- 可备案

**价格：**
- .top 域名：首年 ¥1
- .xyz 域名：首年 ¥1
- .com 域名：约 ¥55/年

---

## 三、DNS 解析配置

### 方案 A：DuckDNS 解析配置

如果你选择了 DuckDNS，解析已经自动完成：

```
域名：minishopify.duckdns.org
IP：47.116.222.5
```

**验证解析：**

```bash
# Windows
nslookup minishopify.duckdns.org

# Mac/Linux
dig minishopify.duckdns.org
ping minishopify.duckdns.org
```

---

### 方案 B：阿里云域名解析配置

如果你在阿里云购买了域名，按以下步骤配置：

#### 步骤 1：进入解析控制台

1. 登录阿里云控制台
2. 进入「云解析 DNS」：https://dns.console.aliyun.com
3. 找到你的域名，点击「解析设置」

#### 步骤 2：添加 A 记录

点击「添加记录」，填写以下信息：

| 配置项 | 值 |
|--------|-----|
| 记录类型 | A |
| 主机记录 | @ |
| 记录值 | 47.116.222.5 |
| TTL | 600（10分钟） |

点击「确认」保存。

#### 步骤 3：添加 www 记录（可选）

再次添加记录：

| 配置项 | 值 |
|--------|-----|
| 记录类型 | A |
| 主机记录 | www |
| 记录值 | 47.116.222.5 |
| TTL | 600 |

#### 步骤 4：添加 API 子域名（可选）

如果 API 需要独立子域名：

| 配置项 | 值 |
|--------|-----|
| 记录类型 | A |
| 主机记录 | api |
| 记录值 | 47.116.222.5 |
| TTL | 600 |

#### 步骤 5：验证解析

```bash
# 等待 10 分钟后验证
ping your-domain.com
nslookup your-domain.com
```

---

### 方案 C：Freenom 域名解析配置

#### 步骤 1：登录 Freenom

访问：https://my.freenom.com

#### 步骤 2：进入域名管理

1. 点击「Services」→「My Domains」
2. 点击域名后面的「Manage Domain」

#### 步骤 3：配置 DNS

1. 点击「Management Tools」→「URL Forwarding」或「DNS Records」
2. 选择「Use custom nameservers」
3. 添加 A 记录：

| Type | Name | Target | TTL |
|------|------|--------|-----|
| A | @ | 47.116.222.5 | 3600 |
| A | www | 47.116.222.5 | 3600 |

#### 步骤 4：保存并等待

保存后等待 DNS 生效（最长 24 小时）

---

## 四、验证域名绑定

### 4.1 检查 DNS 解析

```bash
# 检查域名是否解析到正确 IP
ping minishopify.duckdns.org

# 或使用 nslookup
nslookup minishopify.duckdns.org

# 或使用 dig
dig minishopify.duckdns.org
```

**预期结果：**
```
PING minishopify.duckdns.org (47.116.222.5): 56 data bytes
```

### 4.2 检查服务器端口

```bash
# 检查 80 端口是否开放
curl -I http://47.116.222.5

# 或使用 telnet
telnet 47.116.222.5 80
```

### 4.3 检查安全组

确保阿里云安全组已开放：
- 80 端口（HTTP）
- 443 端口（HTTPS）

**配置路径：**
1. 阿里云控制台 → ECS → 实例
2. 点击实例 ID → 安全组
3. 配置规则 → 入方向 → 添加规则

---

## 五、配置项目使用域名

### 5.1 后端配置

编辑 `/var/www/mini-shopify/packages/backend/.env.production`：

```bash
# 更新回调 URL
NOTIFY_CALLBACK_URL=http://minishopify.duckdns.org/api/notify/register

# 或使用 HTTPS（配置证书后）
NOTIFY_CALLBACK_URL=https://minishopify.duckdns.org/api/notify/register
```

### 5.2 前端配置

编辑 `/var/www/mini-shopify/packages/frontend/.env.production`：

```bash
VITE_API_BASE_URL=http://minishopify.duckdns.org/api
VITE_WS_URL=ws://minishopify.duckdns.org/ws

# 或使用 HTTPS
VITE_API_BASE_URL=https://minishopify.duckdns.org/api
VITE_WS_URL=wss://minishopify.duckdns.org/ws
```

### 5.3 Nginx 配置

编辑 `/etc/nginx/conf.d/mini-shopify.conf`：

```nginx
server {
    listen 80;
    server_name minishopify.duckdns.org;  # 改为你的域名
    
    # 其余配置保持不变
    root /var/www/mini-shopify/frontend-dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://127.0.0.1:3001;
        # ... 其他配置
    }
    
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        # ... 其他配置
    }
}
```

### 5.4 重启服务

```bash
# 重新构建前端
cd /var/www/mini-shopify/packages/frontend
npm run build
cp -r dist/* /var/www/mini-shopify/frontend-dist/

# 重启 Nginx
nginx -t
systemctl restart nginx

# 重启后端
pm2 restart mini-shopify-backend
```

---

## 六、快速操作清单

### 使用 DuckDNS（最快方案）

```bash
# 1. 访问 https://www.duckdns.org
# 2. 使用 GitHub/Google 登录
# 3. 创建子域名：
#    - subdomain: minishopify
#    - current ip: 47.116.222.5
# 4. 点击 add domain
# 5. 完成！域名：minishopify.duckdns.org

# 6. 验证
ping minishopify.duckdns.org
```

### 使用阿里云域名

```bash
# 1. 访问 https://wanwang.aliyun.com/domain
# 2. 搜索并购买域名（新用户有优惠）
# 3. 实名认证
# 4. 进入 https://dns.console.aliyun.com
# 5. 添加 A 记录：
#    - 记录类型：A
#    - 主机记录：@
#    - 记录值：47.116.222.5
# 6. 等待解析生效（10分钟-2小时）
# 7. 验证
ping your-domain.com
```

---

## 七、常见问题

### Q1: 域名解析不生效？

**检查步骤：**
```bash
# 1. 检查 DNS 服务器
nslookup -type=ns your-domain.com

# 2. 检查 A 记录
nslookup your-domain.com

# 3. 使用在线工具
# https://tool.chinaz.com/dns
```

**解决方法：**
- 等待 DNS 缓存刷新（最长 24 小时）
- 清除本地 DNS 缓存：`ipconfig /flushdns`（Windows）

### Q2: 无法通过域名访问？

**检查清单：**
1. DNS 解析是否正确指向 IP
2. 安全组是否开放 80/443 端口
3. Nginx 是否正常运行
4. 服务器防火墙是否开放端口

```bash
# 检查 Nginx
systemctl status nginx

# 检查端口
netstat -tlnp | grep :80

# 检查防火墙（CentOS）
firewall-cmd --list-ports

# 开放端口
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --reload
```

### Q3: DuckDNS IP 更新失败？

DuckDNS IP 可能会自动更新，需要安装客户端：

```bash
# 创建更新脚本
cat > /usr/local/bin/duckdns.sh << 'EOF'
#!/bin/bash
DOMAIN="minishopify"  # 你的子域名
TOKEN="your-token"    # DuckDNS 提供的 token
IP="47.116.222.5"

curl -s "https://www.duckdns.org/update?domains=$DOMAIN&token=$TOKEN&ip=$IP"
EOF

chmod +x /usr/local/bin/duckdns.sh

# 添加定时任务（每小时更新）
crontab -e
# 添加：
0 * * * * /usr/local/bin/duckdns.sh >> /var/log/duckdns.log 2>&1
```

---

## 八、下一步

域名配置完成后，建议：

1. **配置 HTTPS**：使用 Let's Encrypt 免费证书
2. **配置备案**：如果使用国内服务器和阿里云域名，需要 ICP 备案
3. **配置 CDN**：加速静态资源访问

---

*文档生成时间: 2026-04-02*
*目标 IP: 47.116.222.5*