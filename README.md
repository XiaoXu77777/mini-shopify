# Mini-Shopify Antom 集成说明文档

> 本文档用于指导业务甲方集成 Antom 支付 API，标注所有集成位置和重点提示。

---

## 一、项目概述

本项目是一个 **Mini-Shopify 商户入驻系统**，用于模拟 Shopify 商户入驻 Antom 支付服务的完整流程。项目采用前后端分离架构：

- **后端**: Node.js + Express + Prisma + SQLite
- **前端**: React + TypeScript + Ant Design + Vite
- **通信**: RESTful API + WebSocket 实时通知

---

## 二、核心集成接口清单

### 2.1 Antom API 集成点

| 接口名称 | 文档章节 | 后端实现位置 | 用途 |
|---------|---------|-------------|------|
| `register` | 4.1 | `packages/backend/src/services/antomService.ts:252` | 商户注册入驻 |
| `inquireRegistrationStatus` | 4.2 | `packages/backend/src/services/antomService.ts:281` | 查询注册/下线状态 |
| `notifyRegistration` | 4.3 | `packages/backend/src/routes/notify.ts:9` | 异步回调接收 |
| `offboard` | 4.4 | `packages/backend/src/services/antomService.ts:329` | 商户下线 |
| `queryKYBInfo` | 4.5 | `packages/backend/src/services/antomService.ts:389` | 查询 WF 商户 KYB 信息 |

---

## 三、集成位置详解

### 3.1 后端路由结构

**入口文件**: `packages/backend/src/app.ts`

```
/api/merchants     → merchantRouter  (商户管理核心 API)
/api/notify        → notifyRouter    (Antom 回调接收端点)
/api/mock          → mockRouter      (Mock 测试工具)
/api/wf            → wfAuthRouter    (WorldFirst OAuth 流程)
/api/config        → 系统配置接口
```

---

### 3.2 商户管理 API (`/api/merchants`)

**文件位置**: `packages/backend/src/routes/merchant.ts`

| 端点 | 方法 | 功能 | Antom API 调用 |
|------|------|------|---------------|
| `/` | POST | 创建商户 | - |
| `/` | GET | 商户列表 | - |
| `/stats` | GET | 统计数据 | - |
| `/:id` | GET | 商户详情 | - |
| `/:id/wf-account` | POST | 更新 WF 账户 | - |
| `/:id/kyc` | POST | 提交 KYC | - |
| `/:id/entity-associations` | POST | 更新关联实体 | - |
| `/:id/register` | POST | 触发注册 | `register` |
| `/:id/setup-payments` | POST | 一键开通支付 | `queryKYBInfo` + `register` |
| `/:id/registration-status` | GET | 查询注册状态 | `inquireRegistrationStatus` |
| `/:id/offboard` | POST | 商户下线 | `offboard` |
| `/:id/payment-methods` | GET | 支付方式列表 | - |
| `/:id/payment-methods/:pmId/deactivate` | POST | 停用支付方式 | `deactivate` |
| `/:id/notifications` | GET | 通知列表 | - |

---

### 3.3 异步回调接收 (`/api/notify`)

**文件位置**: `packages/backend/src/routes/notify.ts`

```
POST /api/notify/register
```

**重点提示**:
- 此端点需在 Antom Dashboard 中配置为回调 URL
- 已实现签名验证中间件 (`signatureVerify`)
- 必须返回固定格式响应:
  ```json
  {
    "result": {
      "resultCode": "SUCCESS",
      "resultValue": "S",
      "message": "success"
    }
  }
  ```

**支持的通知类型**:
- `REGISTRATION_STATUS` - 注册状态通知
- `PAYMENT_METHOD_ACTIVATION_STATUS` - 支付方式激活通知
- `RISK_NOTIFICATION` - 风控通知

---

### 3.4 WorldFirst OAuth 流程 (`/api/wf`)

**文件位置**: `packages/backend/src/routes/wfAuth.ts`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/login` | GET | WF 登录页面 (模拟) |
| `/authorize` | GET | 重定向到登录 |
| `/query-kyb` | POST | 查询 KYB 信息 |

**OAuth 流程**:
1. 前端打开 `/api/wf/login` 弹窗
2. 用户登录授权后，通过 `postMessage` 返回 `accessToken` 和 `customerId`
3. 前端调用 `/api/wf/query-kyb` 获取 KYB 数据
4. 自动填充 KYC 表单

---

## 四、核心业务流程

### 4.1 场景 A: 商户已有 WorldFirst 账号

**流程图**:
```
[前端] 点击"已有 WF 账户"
   ↓
[前端] 打开 WF 登录弹窗 (/api/wf/login)
   ↓
[用户] 登录授权
   ↓
[前端] postMessage 接收 accessToken + customerId
   ↓
[前端] 调用 /api/wf/query-kyb
   ↓
[后端] antomService.queryKybInfo() → Antom API
   ↓
[前端] 自动填充 KYC 表单
   ↓
[前端] 提交注册
   ↓
[后端] POST /api/merchants/:id/register
   ↓
[后端] antomService.register() → Antom API
   ↓
[Antom] 异步回调 POST /api/notify/register
   ↓
[后端] 更新商户状态 + WebSocket 推送前端
```

**关键代码位置**:
- 前端 WF 连接: `packages/frontend/src/pages/MerchantNew/steps/WfConnect.tsx`
- KYB 查询: `packages/backend/src/services/antomService.ts:389`
- 注册请求构建: `packages/backend/src/services/antomService.ts:142`

---

### 4.2 场景 B: 商户没有 WorldFirst 账号

**流程图**:
```
[前端] 填写基本信息
   ↓
[前端] 手动填写 KYC 信息
   ↓
[前端] 提交注册
   ↓
[后端] POST /api/merchants/:id/register
   ↓
[后端] antomService.register() → Antom API
   ↓
[Antom] 异步回调 POST /api/notify/register
   ↓
[后端] 更新商户状态 + WebSocket 推送前端
```

---

### 4.3 一键开通支付流程

**端点**: `POST /api/merchants/:id/setup-payments`

**文件位置**: `packages/backend/src/routes/merchant.ts:203`

**流程**:
1. 保存 WF 账户 ID
2. 查询 KYB 信息 (`queryKybInfo`)
3. 自动填充 KYC 表单
4. 注册所有支付方式

**请求参数**:
```json
{
  "wfAccountId": "WF_xxxxx",
  "accessToken": "WF_ACCESS_TOKEN_xxxxx",
  "customerId": "CUSTOMER_xxxxx"
}
```

---

## 五、数据模型

**文件位置**: `packages/backend/prisma/schema.prisma`

### 5.1 核心实体

```
Merchant (商户)
├── KycInfo (KYC 信息)
├── EntityAssociation[] (关联实体 - 董事/UBO)
├── PaymentMethod[] (支付方式)
└── Notification[] (通知记录)
```

### 5.2 字段映射关系

| 前端字段 | 数据库字段 | Antom API 字段 |
|---------|-----------|---------------|
| legalName | KycInfo.legalName | merchant.company.legalName |
| companyType | KycInfo.companyType | merchant.company.companyType |
| certificateNo | KycInfo.certificateNo | merchant.company.certificates[].certificateNo |
| mcc | KycInfo.mcc | merchant.businessInfo.mcc |
| entityAssociations | EntityAssociation[] | merchant.entityAssociations |

---

## 六、重点提示

### 6.1 API 签名验证

**文件位置**: `packages/backend/src/middleware/signatureVerify.ts`

**签名流程**:
1. 请求头包含 `Signature`、`Client-Id`、`Request-Time`
2. 使用私钥对请求体签名
3. 响应需验证 Antom 签名

**配置项**:
```env
ANTOM_CLIENT_ID=your_client_id
ANTOM_PRIVATE_KEY=your_private_key
ANTOM_PUBLIC_KEY=antom_public_key
```

---

### 6.2 异步处理机制

**重要**: `register` 和 `offboard` 都是异步处理！

- API 返回 `resultStatus=S` 仅表示调用成功，不代表业务完成
- 实际结果通过 `notifyRegistration` 回调获取
- 备选方案：轮询 `inquireRegistrationStatus`

**回调处理**: `packages/backend/src/services/notifyService.ts`

---

### 6.3 settlementInfoList 差异

**有 WF 账户时**:
```json
{
  "settlementInfoList": [{
    "settlementAccountType": "WORLD_FIRST_ACCOUNT",
    "settlementAccountInfo": { "accountNo": "WF账户号" },
    "settlementCurrency": "HKD"
  }]
}
```

**无 WF 账户时**:
```json
{
  "settlementInfoList": [{
    "settlementCurrency": "HKD"
  }]
}
```

**代码位置**: `packages/backend/src/services/antomService.ts:215`

---

### 6.4 幂等性控制

- `registrationRequestId` - 注册请求幂等 ID
- `offboardingRequestId` - 下线请求幂等 ID
- 相同 ID + 终态请求会返回相同结果

**生成位置**: `packages/backend/src/services/merchantService.ts`

---

### 6.5 错误处理

**ResultStatus 含义**:
- `S` = 成功
- `U` = 未知（可重试）
- `F` = 失败（不可重试）

**重试机制**: `packages/backend/src/services/antomService.ts:70`
- 最大重试次数: 3
- 退避策略: 指数退避 (baseDelayMs * 2^attempt)

---

## 七、Mock 模式

### 7.1 开启 Mock 模式

**配置文件**: `packages/backend/src/utils/config.ts`

```env
MOCK_MODE=true
MOCK_NOTIFY_DELAY_MS=1500
```

**或通过 API 动态切换**:
```bash
curl -X PUT http://localhost:3001/api/config \
  -H "Content-Type: application/json" \
  -d '{"mockMode": true}'
```

---

### 7.2 Mock 预设

**可配置项**:
```json
{
  "mockPresets": {
    "kycResult": "APPROVED",           // APPROVED | REJECTED | SUPPLEMENT_REQUIRED
    "rejectedReason": "风险控制拒绝",
    "rejectedFields": ["certificateNo"],
    "paymentMethodStatuses": {
      "Visa": "ACTIVE",
      "Mastercard": "INACTIVE"
    },
    "riskEnabled": true,
    "riskLevel": "HIGH",
    "riskReasonCodes": ["R001", "R002"]
  }
}
```

**Mock 服务位置**: `packages/backend/src/services/mockService.ts`

---

### 7.3 手动触发通知

**端点**: `POST /api/mock/notify`

```json
{
  "merchantId": "xxx",
  "notificationType": "REGISTRATION_STATUS",
  "data": {
    "registrationStatus": "APPROVED"
  }
}
```

---

## 八、前端集成点

### 8.1 API 客户端

**文件位置**: `packages/frontend/src/services/merchantApi.ts`

**主要方法**:
- `create()` - 创建商户
- `submitKyc()` - 提交 KYC
- `register()` - 注册
- `inquireRegistrationStatus()` - 查询状态
- `offboard()` - 下线
- `queryWfKybInfo()` - 查询 WF KYB
- `setupPayments()` - 一键开通

---

### 8.2 新建商户向导

**文件位置**: `packages/frontend/src/pages/MerchantNew/index.tsx`

**步骤**:
1. BasicInfo - 基本信息
2. WfConnect - WF 连接
3. KycForm - KYC 表单
4. Confirm - 确认提交

---

### 8.3 WebSocket 实时通知

**文件位置**: `packages/backend/src/websocket/index.ts`

**前端 Hook**: `packages/frontend/src/hooks/useWebSocket.ts`

**消息类型**:
- `NOTIFICATION` - 新通知
- `STATUS_CHANGE` - 状态变更

---

## 九、环境配置

### 9.1 后端环境变量

**文件**: `packages/backend/.env`

```env
# 服务端口
PORT=3001

# 数据库
DATABASE_URL=file:./prisma/dev.db

# Antom 配置
ANTOM_CLIENT_ID=
ANTOM_PRIVATE_KEY=
ANTOM_PUBLIC_KEY=
ANTOM_BASE_URL=https://open-sea-global.alipay.com
ANTOM_AGENT_TOKEN=
PARENT_MERCHANT_ID=2188120041577055
DEFAULT_SETTLEMENT_CURRENCY=HKD

# Mock 模式
MOCK_MODE=true
MOCK_NOTIFY_DELAY_MS=1500
NOTIFY_CALLBACK_URL=
```

---

### 9.2 前端代理配置

**文件**: `packages/frontend/vite.config.ts`

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

---

## 十、启动步骤

### 10.1 后端启动

```bash
cd packages/backend
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

### 10.2 前端启动

```bash
cd packages/frontend
npm install
npm run dev
```

### 10.3 访问地址

- 前端: http://localhost:3002
- 后端 API: http://localhost:3001/api
- WebSocket: ws://localhost:3001/ws

---

## 十一、常见问题

### Q1: 回调未收到？

**检查项**:
1. Antom Dashboard 中是否配置了回调 URL
2. 回调 URL 是否可公网访问
3. 签名验证是否通过

### Q2: 注册一直 PROCESSING？

**解决方案**:
1. 检查 Antom 后台审核状态
2. 调用 `inquireRegistrationStatus` 主动查询
3. 查看后端日志确认回调是否收到

### Q3: WF 登录后数据未填充？

**检查项**:
1. `postMessage` 是否正常发送
2. 前端是否正确监听 `message` 事件
3. `/api/wf/query-kyb` 返回是否正常

---

## 十二、文件结构速查

```
packages/
├── backend/
│   ├── src/
│   │   ├── app.ts                    # 应用入口
│   │   ├── routes/
│   │   │   ├── merchant.ts           # 商户 API
│   │   │   ├── notify.ts             # 回调接收
│   │   │   ├── mock.ts               # Mock 工具
│   │   │   └── wfAuth.ts             # WF OAuth
│   │   ├── services/
│   │   │   ├── antomService.ts       # Antom API 封装 ⭐
│   │   │   ├── merchantService.ts    # 商户业务逻辑
│   │   │   ├── notifyService.ts      # 通知处理
│   │   │   └── mockService.ts        # Mock 服务
│   │   ├── middleware/
│   │   │   ├── signatureVerify.ts    # 签名验证 ⭐
│   │   │   └── errorHandler.ts       # 错误处理
│   │   ├── types/
│   │   │   └── index.ts              # 类型定义 ⭐
│   │   └── utils/
│   │       ├── config.ts             # 配置管理
│   │       └── crypto.ts             # 加密工具
│   └── prisma/
│       └── schema.prisma             # 数据库模型
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── MerchantNew/          # 新建商户向导 ⭐
│       │   ├── MerchantDetail/       # 商户详情
│       │   └── Settings.tsx          # 设置页面
│       ├── services/
│       │   ├── api.ts                # Axios 实例
│       │   └── merchantApi.ts        # API 封装
│       └── hooks/
│           └── useWebSocket.ts       # WebSocket Hook
│
└── guide.md                          # Antom 官方集成指南
```

---

## 十三、联系方式

如有集成问题，请联系 Antom 技术支持团队。

**官方文档**: https://docs.antom.com

---

*文档生成时间: 2026-04-02*