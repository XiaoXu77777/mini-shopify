# Mini-Shopify 系统设计方案

> 版本: v1.0 | 状态: 待评审

---

## 一、项目概述

### 1.1 目标

构建一个模拟 Shopify 平台的全栈应用，用于在正式集成前完整演示与 Antom（服务 A）的 ISV 集成流程。系统支持 Mock 模式（无需真实 Antom 环境）和 Production 模式（对接真实 Antom API）。

### 1.2 核心业务流程

```
商户填写开店信息
      │
      ▼
WF OAuth 登录（获取 wfAccountId + KYC 预填数据）
      │
      ▼
填写/补充 KYC 信息 + 选择支付方式
      │
      ▼
提交注册 ──── 调用 Antom /v1/isv/register ────► Antom
      │                                            │
      │◄───── 异步通知 REGISTRATION_STATUS ────────┘
      │◄───── 异步通知 PAYMENT_METHOD_ACTIVATION ──┘
      │◄───── 异步通知 RISK_NOTIFICATION ──────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  KYC APPROVED    → 开店成功          │
│  SUPPLEMENT_REQ  → 修改被驳回字段重提  │
│  REJECTED        → 开店失败          │
└─────────────────────────────────────┘
      │
      ▼ (开店成功后可执行)
关店 (offboard) / 关闭支付方式 (deactivate)
```

### 1.3 设计约束

| 约束 | 说明 |
|------|------|
| 用户角色 | 单商户操作视角，无多用户认证体系 |
| WF 登录 | OAuth 跳转流程，模拟实现，回调返回 wfAccountId |
| 支付方式 | 硬编码列表（Alipay, WeChatPay, UnionPay, VISA, Mastercard） |
| KYC 补充 | 仅被驳回字段可编辑，其余只读 |
| 关店 | 软删除（status=OFFBOARDED），数据保留，不可重新开通 |
| 沙箱环境 | 不考虑，仅 Mock 模式 + Production 模式 |

---

## 二、技术架构

### 2.1 技术选型

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 前端 | React 18 + TypeScript + Ant Design 5 + Vite | 企业级 UI 组件库，TS 类型安全，Vite 快速开发 |
| 后端 | Node.js + Express + TypeScript | 与前端同语言，轻量快速，生态成熟 |
| 数据库 | PostgreSQL 15 + Prisma ORM | 生产级关系型 DB，Prisma 提供类型安全的 ORM |
| 实时通信 | ws 库 | 原生 WebSocket，轻量无冗余（不需要 socket.io 的降级能力） |
| 签名 | Node.js 内置 crypto 模块 | SHA256withRSA，无需额外依赖 |
| 容器化 | Docker + Docker Compose | 一键部署，环境一致性 |
| 前端状态 | React Context + useState | 单商户场景足够，无需引入额外状态库 |

### 2.2 系统架构图

```
┌──────────────────────────────────────────────────────────┐
│                      浏览器 (React SPA)                    │
│                                                           │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐ │
│  │Dashboard │ │开店向导   │ │商户详情    │ │Settings     │ │
│  │商户概览   │ │5步表单    │ │KYC/PM/通知 │ │Mock/Prod切换│ │
│  └─────────┘ └──────────┘ └───────────┘ └─────────────┘ │
│       │            │            │              │          │
│       └────────────┴────────────┴──────────────┘          │
│                        │ HTTP        ▲ WebSocket          │
└────────────────────────┼─────────────┼────────────────────┘
                         │             │
┌────────────────────────▼─────────────┼────────────────────┐
│                   后端 (Express + TS)                      │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                    路由层 (Routes)                     │ │
│  │  /api/merchants/*    商户 CRUD + 注册/关店/关闭PM      │ │
│  │  /api/notify/*       接收 Antom 异步通知               │ │
│  │  /api/wf/*           模拟 WF OAuth 流程               │ │
│  │  /api/mock/*         手动触发 Mock 通知                │ │
│  │  /api/config         获取系统配置（mock模式等）         │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                   服务层 (Services)                    │ │
│  │  merchantService     商户业务逻辑                      │ │
│  │  antomService        Antom API 调用（签名+HTTP）       │ │
│  │  notifyService       通知处理+状态流转                  │ │
│  │  mockService         Mock 模式通知模拟                  │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ 签名/验签     │ │ WebSocket    │ │ 错误处理中间件    │  │
│  │ crypto.ts    │ │ 实时推送      │ │ errorHandler.ts  │  │
│  └──────────────┘ └──────────────┘ └──────────────────┘  │
└────────────────────────┬──────────────────────────────────┘
                         │
                ┌────────▼────────┐
                │   PostgreSQL 15  │
                │                  │
                │  merchants       │
                │  kyc_info        │
                │  payment_methods │
                │  notifications   │
                └─────────────────┘
```

### 2.3 运行模式

```
┌─────────────────────────────────────────────────────────┐
│                     Mock 模式 (MOCK_MODE=true)           │
│                                                          │
│  register() ──► 立即返回成功 ──► 1.5s后自动触发通知       │
│  offboard() ──► 立即返回成功 ──► 直接更新本地状态          │
│  deactivate()──► 立即返回成功 ──► 直接更新本地状态         │
│                                                          │
│  手动触发: POST /api/mock/notify 可模拟全部路径           │
│  (成功/拒绝/补充材料/风险通知/PM激活失败)                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                Production 模式 (MOCK_MODE=false)         │
│                                                          │
│  register() ──► 签名 ──► POST Antom API ──► 验签响应     │
│  offboard() ──► 签名 ──► POST Antom API ──► 验签响应     │
│  deactivate()──► 签名 ──► POST Antom API ──► 验签响应    │
│                                                          │
│  通知接收: POST /api/notify/register ◄── Antom 回调       │
│           验签 ──► 处理 ──► WebSocket 推送前端             │
└─────────────────────────────────────────────────────────┘
```

---

## 三、数据模型设计

### 3.1 ER 关系图

```
┌─────────────┐       1:1       ┌─────────────┐
│  Merchant   │────────────────►│  KycInfo     │
│             │                 │              │
│  id (PK)    │       1:N       │  merchantId  │
│  shopName   │────────────────►│  (FK, unique)│
│  email      │                 └──────────────┘
│  wfAccountId│       1:N       ┌──────────────┐
│  kycStatus  │────────────────►│PaymentMethod │
│  riskLevel  │                 │              │
│  status     │       1:N       │  merchantId  │
│             │────────────────►│  (FK)        │
└─────────────┘                 └──────────────┘
                                ┌──────────────┐
                                │ Notification │
                                │              │
                                │  merchantId  │
                                │  (FK)        │
                                │  notifyId    │
                                │  (unique)    │
                                └──────────────┘
```

### 3.2 merchants 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, auto | 主键 |
| shopName | VARCHAR(255) | NOT NULL | 店铺名称 |
| region | VARCHAR(10) | NOT NULL, DEFAULT 'CN' | 地区 |
| email | VARCHAR(255) | NOT NULL | 商户邮箱 |
| wfAccountId | VARCHAR(128) | NULLABLE | WF 账户 ID（OAuth 回调获得） |
| kycStatus | ENUM | DEFAULT 'PENDING' | PENDING / APPROVED / REJECTED / SUPPLEMENT_REQUIRED |
| riskLevel | VARCHAR(32) | NULLABLE | 风险评级（LOW / MEDIUM / HIGH） |
| riskReasonCodes | JSONB | NULLABLE | 风险原因码数组，如 ["R001","R003"] |
| registrationRequestId | VARCHAR(128) | NULLABLE | Antom 注册请求 ID（register 响应返回） |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE / OFFBOARDED |
| createdAt | TIMESTAMP | auto | 创建时间 |
| updatedAt | TIMESTAMP | auto | 更新时间 |

### 3.3 kyc_info 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, auto | 主键 |
| merchantId | UUID | FK→merchants, UNIQUE | 关联商户（一对一） |
| businessType | VARCHAR(64) | NULLABLE | 企业类型（ENTERPRISE / INDIVIDUAL） |
| legalName | VARCHAR(255) | NULLABLE | 法人/企业名称 |
| idNumber | VARCHAR(64) | NULLABLE | 法人证件号 |
| businessLicense | VARCHAR(128) | NULLABLE | 营业执照号 |
| additionalInfo | JSONB | NULLABLE | 额外补充 KYC 字段 |
| wfKycData | JSONB | NULLABLE | WF OAuth 回显的原始 KYC 数据 |
| rejectedFields | JSONB | NULLABLE | 被驳回的字段列表，如 ["idNumber","businessLicense"] |
| createdAt | TIMESTAMP | auto | 创建时间 |
| updatedAt | TIMESTAMP | auto | 更新时间 |

**rejectedFields 设计说明**: 当收到 `SUPPLEMENT_REQUIRED` 通知时，将驳回字段名存入此字段。前端根据此字段决定哪些表单项可编辑（仅 rejectedFields 中列出的字段可修改，其余只读）。

### 3.4 payment_methods 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, auto | 主键 |
| merchantId | UUID | FK→merchants | 关联商户 |
| paymentMethodType | VARCHAR(32) | NOT NULL | Alipay / WeChatPay / UnionPay / VISA / Mastercard |
| status | ENUM | DEFAULT 'PENDING' | PENDING / ACTIVE / INACTIVE |
| activatedAt | TIMESTAMP | NULLABLE | 激活时间 |
| deactivatedAt | TIMESTAMP | NULLABLE | 关闭时间 |
| createdAt | TIMESTAMP | auto | 创建时间 |
| updatedAt | TIMESTAMP | auto | 更新时间 |

**硬编码支付方式列表**:
```
Alipay, WeChatPay, UnionPay, VISA, Mastercard
```

### 3.5 notifications 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, auto | 主键 |
| merchantId | UUID | FK→merchants | 关联商户 |
| notifyId | VARCHAR(128) | UNIQUE | Antom 通知唯一 ID（幂等键） |
| notificationType | ENUM | NOT NULL | REGISTRATION_STATUS / PAYMENT_METHOD_ACTIVATION_STATUS / RISK_NOTIFICATION |
| payload | JSONB | NOT NULL | 完整通知原始内容 |
| processedAt | TIMESTAMP | DEFAULT now() | 处理时间 |

**幂等设计**: `notifyId` 设为 UNIQUE 约束。收到重复 notifyId 时，直接返回成功不做二次处理。

---

## 四、接口设计

### 4.1 前端 → 后端 API

#### 4.1.1 商户管理

**POST /api/merchants** - 创建商户

```
Request:
{
  "shopName": "My Shop",
  "region": "CN",
  "email": "merchant@example.com"
}

Response 201:
{
  "id": "uuid",
  "shopName": "My Shop",
  "region": "CN",
  "email": "merchant@example.com",
  "kycStatus": "PENDING",
  "status": "ACTIVE",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**GET /api/merchants** - 商户列表

```
Response 200:
{
  "data": [
    {
      "id": "uuid",
      "shopName": "My Shop",
      "kycStatus": "APPROVED",
      "status": "ACTIVE",
      "riskLevel": null,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**GET /api/merchants/:id** - 商户详情（含关联数据）

```
Response 200:
{
  "id": "uuid",
  "shopName": "My Shop",
  "region": "CN",
  "email": "merchant@example.com",
  "wfAccountId": "WF_MOCK_xxx",
  "kycStatus": "APPROVED",
  "riskLevel": null,
  "riskReasonCodes": null,
  "registrationRequestId": "REG_xxx",
  "status": "ACTIVE",
  "kycInfo": {
    "businessType": "ENTERPRISE",
    "legalName": "Mock Corp Ltd.",
    "idNumber": "310XXX...",
    "businessLicense": "MOCK_BL_xxx",
    "additionalInfo": {},
    "wfKycData": { ... },
    "rejectedFields": null
  },
  "paymentMethods": [
    { "id": "uuid", "paymentMethodType": "Alipay", "status": "ACTIVE", "activatedAt": "..." }
  ]
}
```

#### 4.1.2 KYC 与注册

**POST /api/merchants/:id/kyc** - 提交/更新 KYC 信息

```
Request:
{
  "businessType": "ENTERPRISE",
  "legalName": "Mock Corp Ltd.",
  "idNumber": "310XXX199001011234",
  "businessLicense": "MOCK_BL_913100007XXX",
  "additionalInfo": {
    "registeredAddress": "123 Mock Street, Shanghai",
    "contactPhone": "+86-21-12345678"
  }
}

Response 200:
{ "success": true }
```

**POST /api/merchants/:id/register** - 触发 Antom 注册

```
Request:
{
  "paymentMethodTypes": ["Alipay", "WeChatPay"]
}

Response 200:
{
  "registrationRequestId": "REG_xxx",
  "result": {
    "resultStatus": "S",
    "resultCode": "SUCCESS"
  }
}
```

**说明**: register 同步返回（毫秒级）。后续 KYC 审核结果、支付方式激活等通过异步通知下发。

#### 4.1.3 关店与关闭支付方式

**POST /api/merchants/:id/offboard** - 关店

```
Response 200:
{
  "success": true,
  "status": "OFFBOARDED"
}
```

**POST /api/merchants/:id/payment-methods/:pmId/deactivate** - 关闭支付方式

```
Response 200:
{
  "success": true,
  "paymentMethodStatus": "INACTIVE"
}
```

#### 4.1.4 查询

**GET /api/merchants/:id/payment-methods** - 支付方式列表

```
Response 200:
{
  "data": [
    {
      "id": "uuid",
      "paymentMethodType": "Alipay",
      "status": "ACTIVE",
      "activatedAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

**GET /api/merchants/:id/notifications** - 通知记录

```
Response 200:
{
  "data": [
    {
      "id": "uuid",
      "notifyId": "NOTIFY_xxx",
      "notificationType": "REGISTRATION_STATUS",
      "payload": { ... },
      "processedAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

#### 4.1.5 系统配置

**GET /api/config** - 获取当前运行配置

```
Response 200:
{
  "mockMode": true,
  "antomBaseUrl": "https://open-sea-global.alipay.com",
  "mockNotifyDelayMs": 1500
}
```

### 4.2 Antom → Mini-Shopify 通知接口

**POST /api/notify/register** - 接收 Antom 异步通知

请求头（Antom 下发）:
```
Client-Id: <antom_client_id>
Request-Time: <timestamp_ms>
Signature: algorithm=RSA256, keyVersion=1, signature=<url_encoded_signature>
Content-Type: application/json; charset=UTF-8
```

通知体按 notifyType 分为三种:

**类型 1: REGISTRATION_STATUS（KYC 审核结果）**
```json
{
  "notifyId": "NOTIFY_20240101_001",
  "notifyType": "REGISTRATION_STATUS",
  "registrationRequestId": "REG_xxx",
  "registrationStatus": "APPROVED",
  "kycStatus": "APPROVED"
}
```

**SUPPLEMENT_REQUIRED 变体**:
```json
{
  "notifyId": "NOTIFY_20240101_002",
  "notifyType": "REGISTRATION_STATUS",
  "registrationRequestId": "REG_xxx",
  "registrationStatus": "SUPPLEMENT_REQUIRED",
  "rejectedFields": ["idNumber", "businessLicense"],
  "rejectedReason": "证件号格式不正确，请补充修改"
}
```

**REJECTED 变体**:
```json
{
  "notifyId": "NOTIFY_20240101_003",
  "notifyType": "REGISTRATION_STATUS",
  "registrationRequestId": "REG_xxx",
  "registrationStatus": "REJECTED",
  "rejectedReason": "企业信息核验失败"
}
```

**类型 2: PAYMENT_METHOD_ACTIVATION_STATUS**
```json
{
  "notifyId": "NOTIFY_20240101_004",
  "notifyType": "PAYMENT_METHOD_ACTIVATION_STATUS",
  "registrationRequestId": "REG_xxx",
  "paymentMethodType": "Alipay",
  "paymentMethodStatus": "ACTIVE"
}
```

**类型 3: RISK_NOTIFICATION**
```json
{
  "notifyId": "NOTIFY_20240101_005",
  "notifyType": "RISK_NOTIFICATION",
  "registrationRequestId": "REG_xxx",
  "riskLevel": "HIGH",
  "riskReasonCodes": ["R001", "R003"]
}
```

**统一响应格式**:
```json
{
  "result": {
    "resultStatus": "S",
    "resultCode": "SUCCESS",
    "resultMessage": "success"
  }
}
```

### 4.3 后端 → Antom API 调用

#### 通用请求格式

**Base URL**: `https://open-sea-global.alipay.com` (Asia 区域，可配置)

**请求头**:
```
Content-Type: application/json; charset=UTF-8
Client-Id: <ANTOM_CLIENT_ID>
Request-Time: <timestamp_in_ms>
Signature: algorithm=RSA256, keyVersion=1, signature=<generated_signature>
agent-token: <ANTOM_AGENT_TOKEN>
```

**通用响应体**:
```json
{
  "result": {
    "resultStatus": "S | F | U",
    "resultCode": "SUCCESS | ERROR_CODE",
    "resultMessage": "描述信息"
  }
  // ... 业务字段
}
```

#### POST /ams/api/v1/isv/register

```json
Request:
{
  "registrationRequestId": "REG_<uuid>",
  "merchantInfo": {
    "shopName": "My Shop",
    "region": "CN",
    "email": "merchant@example.com",
    "wfAccountId": "WF_MOCK_xxx"
  },
  "kycInfo": {
    "businessType": "ENTERPRISE",
    "legalName": "Mock Corp Ltd.",
    "idNumber": "310XXX199001011234",
    "businessLicense": "MOCK_BL_913100007XXX"
  },
  "paymentMethods": [
    { "paymentMethodType": "Alipay" },
    { "paymentMethodType": "WeChatPay" }
  ],
  "notifyUrl": "https://<your-domain>/api/notify/register"
}
```

#### POST /ams/api/v1/isv/offboard

```json
Request:
{
  "registrationRequestId": "REG_xxx"
}
```

#### POST /ams/api/v1/isv/deactivate

```json
Request:
{
  "registrationRequestId": "REG_xxx",
  "paymentMethodType": "Alipay"
}
```

### 4.4 Mock 触发接口

**POST /api/mock/notify** - 手动触发模拟通知

```json
Request:
{
  "merchantId": "uuid",
  "notificationType": "REGISTRATION_STATUS",
  "data": {
    "registrationStatus": "SUPPLEMENT_REQUIRED",
    "rejectedFields": ["idNumber"],
    "rejectedReason": "证件号格式不正确"
  }
}

Response 200:
{ "success": true, "notifyId": "mock_xxx" }
```

支持模拟的全部路径:

| notificationType | data.registrationStatus / data.paymentMethodStatus / data.riskLevel | 说明 |
|---|---|---|
| REGISTRATION_STATUS | APPROVED | KYC 审核通过 |
| REGISTRATION_STATUS | REJECTED | KYC 审核拒绝 |
| REGISTRATION_STATUS | SUPPLEMENT_REQUIRED | 需补充材料 |
| PAYMENT_METHOD_ACTIVATION_STATUS | ACTIVE | 支付方式激活 |
| PAYMENT_METHOD_ACTIVATION_STATUS | INACTIVE | 支付方式激活失败 |
| RISK_NOTIFICATION | HIGH / MEDIUM / LOW | 风险等级通知 |

---

## 五、核心流程时序图

### 5.1 开店注册（Mock 模式）

```
Browser                Frontend               Backend                  DB
  │                       │                      │                      │
  │── 填写开店信息 ──────►│                      │                      │
  │                       │── POST /merchants ──►│── INSERT merchant ──►│
  │                       │◄─── merchant obj ────│◄─────────────────────│
  │                       │                      │                      │
  │── 点击连接WF ────────►│                      │                      │
  │   (popup window)      │── GET /wf/authorize ►│                      │
  │◄── WF模拟登录页 ──────│◄── HTML ─────────────│                      │
  │── 模拟登录提交 ──────►│── POST /wf/callback ►│                      │
  │◄── postMessage ───────│◄── {wfAccountId,     │                      │
  │   (wfAccountId)       │     kycData} ────────│                      │
  │                       │                      │                      │
  │── 填写KYC+选PM ─────►│                      │                      │
  │── 确认提交 ──────────►│── POST /:id/kyc ────►│── UPSERT kyc_info ──►│
  │                       │◄─── ok ──────────────│◄─────────────────────│
  │                       │── POST /:id/register►│── INSERT PMs ───────►│
  │                       │                      │   (status=PENDING)    │
  │                       │   [Mock: 同步返回成功] │                      │
  │                       │◄─ {regRequestId} ────│                      │
  │                       │                      │                      │
  │                       │              ┌───────┴───────┐              │
  │                       │              │ setTimeout    │              │
  │                       │              │ (1.5s delay)  │              │
  │                       │              └───────┬───────┘              │
  │                       │                      │                      │
  │                       │   [Mock通知触发]       │                      │
  │                       │                      │── UPDATE merchant    │
  │                       │                      │   kycStatus=APPROVED │
  │                       │                      │── UPDATE PMs         │
  │                       │                      │   status=ACTIVE      │
  │                       │                      │── INSERT notification│
  │                       │◄── WebSocket push ───│                      │
  │◄─ Toast: KYC通过！ ──│                      │                      │
  │◄─ 自动刷新页面状态 ──│                      │                      │
```

### 5.2 开店注册（Production 模式）

```
Browser          Frontend            Backend                Antom              DB
  │                 │                   │                     │                 │
  │─ 确认提交 ────►│── POST register ─►│                     │                 │
  │                 │                   │── 构造签名 ─────────┤                 │
  │                 │                   │── POST /v1/isv/     │                 │
  │                 │                   │   register ────────►│                 │
  │                 │                   │◄── 同步响应 ────────│                 │
  │                 │                   │── 验证响应签名       │                 │
  │                 │◄─ regRequestId ──│                     │                 │
  │                 │                   │                     │                 │
  │                 │                   │    (异步，可能数秒~数分钟)             │
  │                 │                   │                     │                 │
  │                 │                   │◄── POST /notify ────│                 │
  │                 │                   │    (带签名头)        │                 │
  │                 │                   │── 验证通知签名       │                 │
  │                 │                   │── 更新DB状态 ───────┤────────────────►│
  │                 │                   │── 返回SUCCESS ─────►│                 │
  │                 │◄── WebSocket ────│                     │                 │
  │◄─ Toast通知 ──│                   │                     │                 │
```

### 5.3 KYC 补充材料流程

```
                                   Backend 收到通知
                                   notifyType=REGISTRATION_STATUS
                                   registrationStatus=SUPPLEMENT_REQUIRED
                                   rejectedFields=["idNumber","businessLicense"]
                                        │
                                        ▼
                              UPDATE merchant SET kycStatus='SUPPLEMENT_REQUIRED'
                              UPDATE kyc_info SET rejectedFields='["idNumber","businessLicense"]'
                              INSERT notification
                                        │
                                        ▼ WebSocket push
                                    ┌───────────┐
                                    │  Frontend  │
                                    └─────┬─────┘
                                          │
                                          ▼
                               显示 Alert: "KYC 审核需要补充材料"
                               KYC Tab 中:
                                 - idNumber 字段: 可编辑 (高亮)
                                 - businessLicense 字段: 可编辑 (高亮)
                                 - 其余字段: 只读 (disabled)
                                 - 显示 rejectedReason
                                          │
                                          ▼ 用户修改后提交
                               POST /api/merchants/:id/kyc  (仅更新修改字段)
                               POST /api/merchants/:id/register  (重新注册)
                                          │
                                          ▼
                               等待新的异步通知...
```

### 5.4 关店流程

```
Browser            Frontend              Backend                  Antom           DB
  │                   │                     │                       │              │
  │─ 点击"关店" ────►│                     │                       │              │
  │◄─ 二次确认弹窗 ──│                     │                       │              │
  │─ 确认 ──────────►│── POST offboard ──►│                       │              │
  │                   │                     │ [Prod: POST /v1/isv/ │              │
  │                   │                     │  offboard + 签名]────►│              │
  │                   │                     │◄── 响应 ──────────────│              │
  │                   │                     │ [Mock: 直接处理]       │              │
  │                   │                     │── UPDATE merchant ───┤─────────────►│
  │                   │                     │   status=OFFBOARDED   │              │
  │                   │◄─── success ───────│                       │              │
  │◄─ 页面更新 ──────│                     │                       │              │
  │   (显示已关店状态) │                     │                       │              │
```

---

## 六、签名与验签规范

### 6.1 签名流程（调用 Antom API 时）

基于 Antom 官方文档，使用 **SHA256withRSA** 算法。

**Step 1: 构造待签名内容**

```
content_to_be_signed = "<http-method> <http-uri>\n<client-id>.<request-time>.<request-body>"
```

| 组成部分 | 说明 | 示例 |
|----------|------|------|
| http-method | 固定 POST | `POST` |
| http-uri | 请求路径（不含域名） | `/ams/api/v1/isv/register` |
| client-id | Antom Dashboard 获取 | `PROD_5Yxxxxxxxxxx` |
| request-time | 毫秒时间戳 | `1685599933871` |
| request-body | JSON 请求体原文 | `{"registrationRequestId":"..."}` |

拼接示例:
```
POST /ams/api/v1/isv/register
PROD_5Yxxxxxxxxxx.1685599933871.{"registrationRequestId":"REG_xxx",...}
```

**Step 2: 生成签名**

```
generated_signature = urlEncode(base64Encode(sha256withRSA(content_to_be_signed, privateKey)))
```

- `sha256withRSA`: Node.js `crypto.createSign('SHA256')` + PKCS8 私钥
- `base64Encode`: Buffer.toString('base64')
- `urlEncode`: encodeURIComponent()

**Step 3: 组装请求头**

```
Signature: algorithm=RSA256, keyVersion=1, signature=<generated_signature>
```

### 6.2 验签流程（接收 Antom 响应/通知时）

**Step 1: 从响应头/通知头获取**
- `client-id`
- `response-time` (响应) 或 `request-time` (通知)
- `signature` 头中解析出 `target_signature`

**Step 2: 构造待验证内容**

响应验签:
```
content_to_be_validated = "POST <http-uri>\n<client-id>.<response-time>.<response-body>"
```

通知验签:
```
content_to_be_validated = "POST <http-uri>\n<client-id>.<request-time>.<notify-body>"
```

**重要**: 使用原始 HTTP body，不要 parse 后重新 JSON.stringify，否则验签失败。

**Step 3: 验证签名**
```
result = sha256withRSA_verify(
  base64Decode(urlDecode(target_signature)),
  content_to_be_validated,
  antomPublicKey
)
```

- `urlDecode`: decodeURIComponent()
- `base64Decode`: Buffer.from(str, 'base64')
- `sha256withRSA_verify`: Node.js `crypto.createVerify('SHA256')` + X509 公钥

### 6.3 密钥规格

| 密钥 | 格式 | 用途 |
|------|------|------|
| 商户私钥 | PKCS8, Base64 encoded PEM | 签名请求 |
| Antom 公钥 | X509, Base64 encoded PEM | 验证响应/通知签名 |

### 6.4 Node.js 伪代码

```typescript
// 签名
function sign(httpUri: string, clientId: string, requestTime: string,
              requestBody: string, privateKeyBase64: string): string {
  const contentToSign = `POST ${httpUri}\n${clientId}.${requestTime}.${requestBody}`;
  const signer = crypto.createSign('SHA256');
  signer.update(contentToSign, 'utf8');
  const privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKeyBase64}\n-----END PRIVATE KEY-----`;
  const signature = signer.sign(privateKey, 'base64');
  return encodeURIComponent(signature);
}

// 验签
function verify(httpUri: string, clientId: string, responseTime: string,
                responseBody: string, targetSignature: string,
                publicKeyBase64: string): boolean {
  const contentToVerify = `POST ${httpUri}\n${clientId}.${responseTime}.${responseBody}`;
  const verifier = crypto.createVerify('SHA256');
  verifier.update(contentToVerify, 'utf8');
  const publicKey = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;
  const decodedSig = Buffer.from(decodeURIComponent(targetSignature), 'base64');
  return verifier.verify(publicKey, decodedSig);
}
```

---

## 七、通知处理机制

### 7.1 通知接收流程

```
Antom POST /api/notify/register
        │
        ▼
  [Production模式] 验证 RSA 签名
  [Mock模式] 跳过签名验证
        │
        ▼
  解析 notifyId，查库判断是否已处理（幂等）
        │
   ┌────┴──── 已存在 ────► 直接返回 SUCCESS（不重复处理）
   │
   ▼ 不存在
  根据 notifyType 分发处理:
        │
   ┌────┼──────────────────────┐
   │    │                      │
   ▼    ▼                      ▼
REGISTRATION  PM_ACTIVATION   RISK_NOTIFICATION
   │    │                      │
   ▼    ▼                      ▼
更新    更新                   更新
merchant PaymentMethod         merchant
kycStatus status               riskLevel
(+rejectedFields               riskReasonCodes
 if supplement)
        │
        ▼
  INSERT notification 记录
        │
        ▼
  WebSocket 推送到前端
        │
        ▼
  返回 { result: { resultStatus: "S", resultCode: "SUCCESS" } }
```

### 7.2 状态流转规则

**merchant.kycStatus 流转**:
```
PENDING ──► APPROVED          (正常通过)
PENDING ──► REJECTED          (审核拒绝)
PENDING ──► SUPPLEMENT_REQUIRED (需补充)
SUPPLEMENT_REQUIRED ──► APPROVED   (补充后通过)
SUPPLEMENT_REQUIRED ──► REJECTED   (补充后仍拒绝)
SUPPLEMENT_REQUIRED ──► SUPPLEMENT_REQUIRED (再次补充)
```

**paymentMethod.status 流转**:
```
PENDING ──► ACTIVE    (激活成功)
PENDING ──► INACTIVE  (激活失败)
ACTIVE  ──► INACTIVE  (手动关闭 deactivate)
```

**merchant.status 流转**:
```
ACTIVE ──► OFFBOARDED  (关店，不可逆)
```

---

## 八、WebSocket 实时通信设计

### 8.1 连接管理

```
客户端连接: ws://localhost:3001/ws?merchantId=<uuid>

服务端维护: Map<merchantId, Set<WebSocket>>

连接生命周期:
  connect  → 加入 merchantId 对应的 Set
  close    → 从 Set 中移除
  error    → 清理连接
```

### 8.2 消息格式

服务端 → 客户端（推送通知）:
```json
{
  "type": "NOTIFICATION",
  "data": {
    "notificationType": "REGISTRATION_STATUS",
    "merchantId": "uuid",
    "kycStatus": "APPROVED",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

服务端 → 客户端（状态变更）:
```json
{
  "type": "STATUS_CHANGE",
  "data": {
    "merchantId": "uuid",
    "field": "kycStatus",
    "oldValue": "PENDING",
    "newValue": "APPROVED"
  }
}
```

### 8.3 前端处理

```typescript
// useWebSocket hook
// - 自动连接，带 merchantId
// - 断线自动重连（指数退避，最大 30s）
// - 收到消息时触发 Antd notification.info() Toast
// - 触发页面数据刷新（重新 fetch 商户详情）
```

---

## 九、前端页面设计

### 9.1 路由结构

```
/                           → Dashboard（商户概览）
/merchants                  → 商户列表
/merchants/new              → 开店向导（5步表单）
/merchants/:id              → 商户详情（Tab 页）
/settings                   → 系统配置
```

### 9.2 页面详细设计

#### Dashboard (/)

```
┌─────────────────────────────────────────────────┐
│  Mini-Shopify Dashboard                         │
├─────────┬──────────┬──────────┬────────────────┤
│ 总商户数 │ KYC通过  │ KYC待审  │ 已关店         │
│   12    │    8     │    3     │    1           │
├─────────┴──────────┴──────────┴────────────────┤
│  最近通知                                       │
│  ┌────────────────────────────────────────────┐│
│  │ 2024-01-01 KYC APPROVED - My Shop         ││
│  │ 2024-01-01 PM ACTIVE - Alipay             ││
│  │ 2023-12-31 RISK HIGH - Another Shop       ││
│  └────────────────────────────────────────────┘│
│                                                 │
│  [+ 新建商户]                                    │
└─────────────────────────────────────────────────┘
```

#### 开店向导 (/merchants/new)

**5 步 Ant Design Steps 组件**:

| Step | 标题 | 内容 |
|------|------|------|
| 1 | 基础信息 | shopName, email, region(下拉) |
| 2 | WF 账户关联 | "连接 WF 账户"按钮 → popup OAuth → 获取 wfAccountId |
| 3 | KYC 信息 | 表单预填 WF 返回的 kycData，用户可编辑补充 |
| 4 | 选择支付方式 | Checkbox Group（Alipay/WeChatPay/UnionPay/VISA/Mastercard） |
| 5 | 确认提交 | 汇总展示所有信息，"提交注册"按钮 |

**Step 2 WF OAuth 流程**:
1. 前端调用 `window.open('/api/wf/authorize', 'wf_oauth', 'width=600,height=400')`
2. 弹窗显示模拟 WF 登录页面
3. 用户点击"授权登录"
4. 后端返回 HTML，通过 `window.opener.postMessage({wfAccountId, kycData})` 回传数据
5. 弹窗自动关闭
6. 前端监听 `message` 事件，接收 wfAccountId 和 kycData

**WF 模拟返回的 KYC 数据结构**:
```json
{
  "businessType": "ENTERPRISE",
  "legalName": "Mock Corp Ltd.",
  "registeredAddress": "123 Mock Street, Shanghai, CN",
  "businessLicense": "MOCK_BL_91310000XXXXXXXX",
  "legalRepName": "张三",
  "legalRepIdType": "ID_CARD",
  "legalRepIdNumber": "310101199001011234",
  "contactPhone": "+86-21-12345678",
  "bankAccount": "6222021234567890123",
  "bankName": "Mock Bank"
}
```

#### 商户详情 (/merchants/:id)

**Tab 布局**:

| Tab | 内容 |
|-----|------|
| 概览 | 商户基本信息 + 状态流转 Timeline + 风险等级标签 |
| KYC | KYC 详情表单（SUPPLEMENT_REQUIRED 时高亮可编辑字段） |
| 支付方式 | 支付方式列表表格，每行有状态标签和"关闭"按钮 |
| 通知记录 | 通知历史表格，可展开查看完整 payload |

**概览 Tab 状态 Timeline**:
```
● 商户创建          2024-01-01 10:00
● WF 账户关联       2024-01-01 10:02
● KYC 提交          2024-01-01 10:05
● 注册提交          2024-01-01 10:05
● KYC 审核通过      2024-01-01 10:06  ← 通知触发
● Alipay 已激活     2024-01-01 10:06  ← 通知触发
● WeChatPay 已激活  2024-01-01 10:07  ← 通知触发
```

**KYC Tab 补充模式**:
- `kycStatus === 'SUPPLEMENT_REQUIRED'` 时顶部显示 Alert 警告
- 表单字段根据 `rejectedFields` 数组判断:
  - 在 rejectedFields 中 → Input 正常可编辑 + 红色边框高亮
  - 不在 rejectedFields 中 → Input disabled
- 底部显示 rejectedReason
- "重新提交"按钮 → 调 POST kyc + POST register

#### Settings (/settings)

```
┌─────────────────────────────────────────────────┐
│  系统配置                                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  运行模式: [Mock ◉ ] [Production ○]              │
│                                                  │
│  Mock 通知延迟: [1500] ms                         │
│                                                  │
│  ─── Antom 配置（仅 Production 模式） ───         │
│  Client ID:    PROD_5Yxxxxxxxxxx                 │
│  Base URL:     https://open-sea-global.alipay.com│
│  Agent Token:  ********                          │
│  回调地址:     https://your-domain/api/notify/... │
│                                                  │
│  ─── Mock 通知触发面板 ──────────────────         │
│  商户: [下拉选择]                                  │
│  通知类型: [下拉选择]                              │
│  [触发 KYC通过] [触发 KYC拒绝] [触发补充材料]      │
│  [触发 PM激活] [触发 PM失败] [触发风险通知]         │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 十、Mock 模式设计

### 10.1 自动触发机制

当 `MOCK_MODE=true` 时，register 接口在同步返回成功后:

```
register() 调用
      │
      ▼ 同步返回 (毫秒级)
{ registrationRequestId: "REG_xxx", result: { resultStatus: "S" } }
      │
      ▼ setTimeout(MOCK_NOTIFY_DELAY_MS = 1500ms)
自动触发通知序列:
  1. REGISTRATION_STATUS (kycStatus=APPROVED)
  2. PAYMENT_METHOD_ACTIVATION_STATUS × N (每个选中的PM)
      │
      ▼ 每个通知
  走正常 notifyService 处理流程 (更新DB + WebSocket推送)
```

### 10.2 手动触发面板

通过 Settings 页面或直接调 `POST /api/mock/notify`，可模拟:

| 场景 | notificationType | 关键数据 |
|------|-------------------|----------|
| KYC 通过 | REGISTRATION_STATUS | registrationStatus=APPROVED |
| KYC 拒绝 | REGISTRATION_STATUS | registrationStatus=REJECTED, rejectedReason |
| 需补充材料 | REGISTRATION_STATUS | registrationStatus=SUPPLEMENT_REQUIRED, rejectedFields |
| PM 激活 | PAYMENT_METHOD_ACTIVATION_STATUS | paymentMethodStatus=ACTIVE |
| PM 激活失败 | PAYMENT_METHOD_ACTIVATION_STATUS | paymentMethodStatus=INACTIVE |
| 风险通知(高) | RISK_NOTIFICATION | riskLevel=HIGH, riskReasonCodes |
| 风险通知(低) | RISK_NOTIFICATION | riskLevel=LOW |

### 10.3 Mock WF OAuth

后端 `/api/wf/authorize` 返回一个简单的 HTML 页面:
- 显示模拟 WF 品牌样式
- 预填的用户名/密码（纯展示）
- "授权登录"按钮
- 点击后执行 `window.opener.postMessage(...)` 将 wfAccountId + kycData 回传
- 自动 `window.close()`

---

## 十一、环境变量设计

```bash
# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/minishopify

# Antom 配置
ANTOM_CLIENT_ID=                    # Antom Dashboard 获取的 Client ID
ANTOM_PRIVATE_KEY=                  # Base64 编码的 PKCS8 私钥
ANTOM_PUBLIC_KEY=                   # Base64 编码的 Antom X509 公钥
ANTOM_BASE_URL=https://open-sea-global.alipay.com
ANTOM_AGENT_TOKEN=                  # ISV Agent Token

# 运行模式
MOCK_MODE=true                      # true=Mock模式, false=Production模式
MOCK_NOTIFY_DELAY_MS=1500           # Mock通知自动触发延迟(ms)

# 服务配置
PORT=3001                           # 后端端口
NOTIFY_CALLBACK_URL=                # 公网回调地址（Production模式需要）
```

---

## 十二、项目目录结构

```
mini-shopify/
├── docker-compose.yml
├── .env.example
├── packages/
│   ├── frontend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── nginx.conf                    # 生产部署 Nginx 配置
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── main.tsx                   # 入口
│   │       ├── App.tsx                    # 路由配置
│   │       ├── components/
│   │       │   ├── Layout/
│   │       │   │   └── AppLayout.tsx      # Ant Design Layout + 侧边栏
│   │       │   ├── MerchantStatusTag.tsx   # 状态标签组件
│   │       │   └── KycTimeline.tsx         # KYC 流程 Timeline
│   │       ├── pages/
│   │       │   ├── Dashboard/
│   │       │   │   └── index.tsx
│   │       │   ├── MerchantList/
│   │       │   │   └── index.tsx
│   │       │   ├── MerchantNew/
│   │       │   │   ├── index.tsx          # 向导容器
│   │       │   │   └── steps/
│   │       │   │       ├── BasicInfo.tsx
│   │       │   │       ├── WfConnect.tsx
│   │       │   │       ├── KycForm.tsx
│   │       │   │       ├── PaymentSelect.tsx
│   │       │   │       └── Confirm.tsx
│   │       │   ├── MerchantDetail/
│   │       │   │   ├── index.tsx          # Tab 容器
│   │       │   │   └── tabs/
│   │       │   │       ├── Overview.tsx
│   │       │   │       ├── KycTab.tsx
│   │       │   │       ├── PaymentMethods.tsx
│   │       │   │       └── Notifications.tsx
│   │       │   └── Settings/
│   │       │       └── index.tsx
│   │       ├── services/
│   │       │   ├── api.ts                 # Axios 实例
│   │       │   ├── merchantApi.ts         # 商户相关 API
│   │       │   └── mockApi.ts             # Mock 触发 API
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts        # WS 连接 + 自动重连
│   │       │   └── useNotification.ts     # WS 消息 → Antd Toast
│   │       ├── context/
│   │       │   └── AppContext.tsx          # 全局 Context (mockMode, ws)
│   │       ├── types/
│   │       │   └── index.ts
│   │       └── utils/
│   │           └── constants.ts           # 支付方式列表、状态枚举
│   │
│   └── backend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.ts                    # 可选: 种子数据
│       └── src/
│           ├── app.ts                     # Express 入口 + WS 挂载
│           ├── routes/
│           │   ├── merchant.ts
│           │   ├── notify.ts
│           │   ├── mock.ts
│           │   └── wfAuth.ts
│           ├── services/
│           │   ├── merchantService.ts
│           │   ├── antomService.ts
│           │   ├── notifyService.ts
│           │   └── mockService.ts
│           ├── middleware/
│           │   ├── signatureVerify.ts
│           │   └── errorHandler.ts
│           ├── websocket/
│           │   └── index.ts
│           ├── utils/
│           │   ├── crypto.ts              # RSA 签名/验签
│           │   └── config.ts              # 环境变量加载
│           └── types/
│               └── index.ts
│
└── README.md (仅在被要求时创建)
```

---

## 十三、Docker 部署设计

### 13.1 docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: minishopify
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./packages/backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/minishopify
      MOCK_MODE: "true"
      PORT: "3001"
    depends_on:
      db:
        condition: service_healthy
    # 启动时自动执行 prisma migrate deploy

  frontend:
    build: ./packages/frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

### 13.2 Backend Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npx prisma generate
RUN npm run build
# 启动命令: migrate + start
CMD npx prisma migrate deploy && node dist/app.js
```

### 13.3 Frontend Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 13.4 Nginx 配置

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 十四、错误处理策略

| 场景 | 处理方式 |
|------|----------|
| Antom API 调用失败 | 返回错误给前端，前端显示错误提示，不更新本地状态 |
| Antom 响应签名验证失败 | 拒绝响应，返回 500 给前端 |
| 通知签名验证失败 | 返回 401，不处理通知 |
| 重复通知 (notifyId 冲突) | 返回 SUCCESS，不重复处理（幂等） |
| DB 操作失败 | 返回 500，错误日志记录 |
| WebSocket 连接断开 | 前端指数退避重连（1s, 2s, 4s, 8s... 最大 30s） |
| Mock 模式下 Antom 配置为空 | 正常运行，跳过签名和 API 调用 |
