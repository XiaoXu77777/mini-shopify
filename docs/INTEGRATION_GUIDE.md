# Antom 商户入驻集成引导文档

## 一、概述

本文档描述如何集成 Antom 商户入驻相关接口，实现二级商户的快速入驻。集成接口包括：

| 接口 | 用途 |
|------|------|
| `/auth` | WF OAuth2.0 授权链接 |
| `/amsin/api/v1/oauth/applyToken` | WF 申请 Token |
| `/ams/v1/merchant/queryKybInfo` | 查询二级商户 KYB 信息 |
| `/ams/api/v1/merchant/register` | 二级商户入驻 |
| `/ams/api/v1/merchants/inquiryRegistrationStatus` | 入驻结果查询 |
| `notifyRegistration` | 入驻结果通知（回调） |

---

## 二、集成流程

### 2.1 完整入驻流程（有 WF 账户）

```
┌─────────────────────────────────────────────────────────────────┐
│                        完整入驻流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 获取授权链接                                                 │
│     POST /auth                                                  │
│     └─→ 返回 WorldFirst OAuth URL                               │
│                                                                 │
│  2. 用户授权                                                     │
│     用户跳转至 WF 页面 → 授权 → 回调带 authCode                   │
│                                                                 │
│  3. 换取 Token                                                   │
│     POST /amsin/api/v1/oauth/applyToken                         │
│     └─→ 返回 accessToken, customerId, wfAccountId               │
│                                                                 │
│  4. 查询 KYB 信息                                                │
│     POST /ams/v1/merchant/queryKybInfo                          │
│     └─→ 返回商户 KYB 数据（用于预填表单）                         │
│                                                                 │
│  5. 提交入驻申请                                                 │
│     POST /ams/api/v1/merchant/register                          │
│     └─→ 返回 registrationRequestId                              │
│                                                                 │
│  6. 等待结果                                                     │
│     方式一：异步回调 notifyRegistration                          │
│     方式二：轮询 inquiryRegistrationStatus                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 时序图

```
┌──────┐     ┌──────┐     ┌───────────┐     ┌───────────┐
│ 商户  │     │ ISV  │     │ WorldFirst│     │   Antom   │
└──┬───┘     └──┬───┘     └─────┬─────┘     └─────┬─────┘
   │            │               │                 │
   │ 1.发起入驻  │               │                 │
   │───────────>│               │                 │
   │            │ 2.获取授权URL  │                 │
   │            │──────────────>│                 │
   │            │<──────────────│                 │
   │            │               │                 │
   │ 3.跳转授权  │               │                 │
   │<───────────│               │                 │
   │───────────────────────────>│                 │
   │            │ 4.回调authCode │                 │
   │            │<──────────────│                 │
   │            │               │                 │
   │            │ 5.换取Token   │                 │
   │            │──────────────>│                 │
   │            │<──────────────│                 │
   │            │               │                 │
   │            │ 6.查询KYB     │                 │
   │            │──────────────>│                 │
   │            │<──────────────│                 │
   │            │               │                 │
   │            │ 7.提交入驻     │                 │
   │            │────────────────────────────────>│
   │            │<────────────────────────────────│
   │            │               │                 │
   │            │ 8.入驻结果通知 │                 │
   │            │<────────────────────────────────│
   │            │               │                 │
   │ 9.入驻完成  │               │                 │
   │<───────────│               │                 │
```

---

## 三、接口详细说明

### 3.1 WF OAuth 授权链接

**接口路径**: `POST /auth`

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| merchantId | String | 是 | 商户唯一标识 |
| redirectUrl | String | 否 | 回调地址（不传使用默认配置） |

**请求示例**:
```json
{
  "merchantId": "MERCHANT_001",
  "redirectUrl": "https://your-domain.com/callback"
}
```

**响应示例**:
```json
{
  "success": true,
  "oauthUrl": "https://portal.worldfirst.com/auth/yourApp?oauthClientId=xxx&scopes=QUERY_KYB_INFO&state=xxx&redirectUri=xxx"
}
```

**URL 参数说明**:
- `oauthClientId`: WF 应用 Client ID
- `scopes`: 授权范围，如 `QUERY_KYB_INFO`
- `state`: 防重放攻击的唯一标识
- `redirectUri`: 授权后回调地址

---

### 3.2 WF 申请 Token

**接口路径**: `POST /amsin/api/v1/oauth/applyToken`

**请求头**:

| Header | 说明 |
|--------|------|
| client-id | WF 应用 Client ID |
| Request-Time | 请求时间戳（毫秒） |
| Signature | 签名（见签名机制章节） |
| Content-Type | application/json |

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| authCode | String | 是 | OAuth 回调获取的授权码 |
| grantType | String | 是 | 固定值 `AUTHORIZATION_CODE` |

**请求示例**:
```json
{
  "authCode": "AUTH_CODE_xxxxx",
  "grantType": "AUTHORIZATION_CODE"
}
```

**响应示例（成功）**:
```json
{
  "result": {
    "resultStatus": "S",
    "resultCode": "SUCCESS",
    "resultMessage": "success"
  },
  "accessToken": "WF_ACCESS_TOKEN_xxxxx",
  "customerId": "CUSTOMER_xxxxx",
  "wfAccountId": "WF_xxxxx",
  "expiresIn": 3600
}
```

**响应示例（失败）**:
```json
{
  "result": {
    "resultStatus": "F",
    "resultCode": "INVALID_AUTH_CODE",
    "resultMessage": "Authorization code is invalid or expired"
  }
}
```

---

### 3.3 查询二级商户 KYB 信息

**接口路径**: `POST /ams/v1/merchant/queryKybInfo`

**请求头**:

| Header | 说明 |
|--------|------|
| client-id | WF 应用 Client ID |
| Request-Time | 请求时间戳（毫秒） |
| Signature | 签名 |
| Content-Type | application/json |

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| accessToken | String | 是 | WF 访问令牌 |
| customerId | String | 否 | 客户 ID |

**请求示例**:
```json
{
  "accessToken": "WF_ACCESS_TOKEN_xxxxx",
  "customerId": "CUSTOMER_xxxxx"
}
```

**响应示例**:
```json
{
  "result": {
    "resultStatus": "S",
    "resultCode": "SUCCESS",
    "resultMessage": "success"
  },
  "kybInfo": {
    "legalName": "Example Company Ltd",
    "companyType": "ENTERPRISE",
    "incorporationDate": "2020-01-15",
    "vatNo": "123456789",
    "certificates": [
      {
        "certificateNo": "91110000MA00xxxx",
        "certificateType": "ENTERPRISE_REGISTRATION",
        "fileList": [
          {
            "fileName": "business_license.pdf",
            "fileUrl": "https://wf-cdn.example.com/xxx"
          }
        ]
      }
    ],
    "registeredAddress": {
      "region": "CN",
      "state": "Beijing",
      "city": "Beijing",
      "address1": "Chaoyang District",
      "address2": "Building A, Floor 5",
      "zipCode": "100000"
    },
    "businessInfo": {
      "appName": "My Shop",
      "merchantBrandName": "My Brand",
      "mcc": "5734",
      "doingBusinessAs": "My Shop Store",
      "websiteUrl": "https://myshop.example.com"
    },
    "contactMethods": [
      {
        "contactMethodType": "EMAIL",
        "contactMethodInfo": "contact@example.com"
      }
    ],
    "entityAssociations": [
      {
        "associationType": "UBO",
        "legalEntityType": "INDIVIDUAL",
        "individual": {
          "fullName": "John Doe",
          "nationality": "CN",
          "dateOfBirth": "1985-06-15",
          "residentialAddress": {...}
        }
      }
    ],
    "stores": [
      {
        "name": "Main Store",
        "referenceStoreId": "STORE_001",
        "region": "HK",
        "mcc": "5734",
        "address": {...}
      }
    ]
  }
}
```

---

### 3.4 二级商户入驻

**接口路径**: `POST /ams/api/v1/merchant/register`

**请求头**:

| Header | 说明 |
|--------|------|
| client-id | Antom Client ID |
| Request-Time | 请求时间戳（毫秒） |
| Signature | 签名 |
| Content-Type | application/json |

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| registrationRequestId | String | 是 | 注册请求幂等 ID |
| partnerId | String | 是 | 父商户 ID（ISV 的商户 ID） |
| merchant | Object | 是 | 商户信息 |
| settlementInfoList | Array | 是 | 结算账户信息 |
| paymentMethodActivationRequests | Array | 是 | 支付方式激活请求 |

**请求示例**:
```json
{
  "registrationRequestId": "REG_20240115_001",
  "partnerId": "2188120272582435",
  "merchant": {
    "loginId": "merchant@example.com",
    "legalEntityType": "COMPANY",
    "integrationPartnerId": "2188120272582435",
    "referenceMerchantId": "MERCHANT_001",
    "businessInfo": {
      "appName": "My Shop",
      "doingBusinessAs": "My Shop Store",
      "mcc": "5734",
      "merchantBrandName": "My Brand",
      "websites": [
        {
          "type": "COMMON",
          "url": "https://myshop.example.com"
        }
      ]
    },
    "company": {
      "legalName": "Example Company Ltd",
      "companyType": "ENTERPRISE",
      "incorporationDate": "2020-01-15",
      "vatNo": "123456789",
      "certificates": [
        {
          "certificateNo": "91110000MA00xxxx",
          "certificateType": "ENTERPRISE_REGISTRATION",
          "fileList": [
            {
              "fileName": "business_license.pdf",
              "fileUrl": "https://example.com/license.pdf"
            }
          ]
        }
      ],
      "registeredAddress": {
        "region": "CN",
        "state": "Beijing",
        "city": "Beijing",
        "address1": "Chaoyang District",
        "address2": "Building A, Floor 5",
        "zipCode": "100000"
      },
      "contactMethods": [
        {
          "contactMethodType": "EMAIL",
          "contactMethodInfo": "contact@example.com"
        }
      ]
    },
    "entityAssociations": [
      {
        "associationType": "UBO",
        "legalEntityType": "INDIVIDUAL",
        "individual": {
          "fullName": "John Doe",
          "nationality": "CN",
          "dateOfBirth": "1985-06-15",
          "residentialAddress": {
            "region": "CN",
            "state": "Beijing",
            "city": "Beijing",
            "address1": "Chaoyang District",
            "zipCode": "100000"
          },
          "identityCard": {
            "identityCardNumber": "110105198506150000",
            "identityCardType": "NATIONAL_ID"
          }
        }
      }
    ],
    "stores": [
      {
        "name": "Main Store",
        "referenceStoreId": "STORE_001",
        "region": "HK",
        "mcc": "5734",
        "address": {
          "region": "HK",
          "city": "Hong Kong",
          "address1": "Central District"
        },
        "attachments": [
          {
            "attachmentType": "SHOP_DOOR_HEAD_PIC",
            "fileList": [
              {
                "fileName": "shop_photo.jpg",
                "fileUrl": "https://example.com/shop.jpg"
              }
            ]
          }
        ]
      }
    ]
  },
  "settlementInfoList": [
    {
      "settlementAccountType": "WORLD_FIRST_ACCOUNT",
      "settlementAccountInfo": {
        "accountNo": "WF_xxxxx"
      },
      "settlementCurrency": "HKD"
    }
  ],
  "paymentMethodActivationRequests": [
    {
      "paymentMethodType": "VISA",
      "productCodes": ["CASHIER_PAYMENT"]
    },
    {
      "paymentMethodType": "MASTERCARD",
      "productCodes": ["CASHIER_PAYMENT"]
    },
    {
      "paymentMethodType": "ALIPAY_HK",
      "productCodes": ["CASHIER_PAYMENT"]
    }
  ]
}
```

**响应示例**:
```json
{
  "registrationRequestId": "REG_20240115_001",
  "resultInfo": {
    "resultStatus": "S",
    "resultCode": "SUCCESS",
    "resultMessage": "success"
  }
}
```

> **注意**: `resultStatus=S` 仅表示接口调用成功，不代表入驻完成。实际入驻结果通过异步回调获取。

---

### 3.5 入驻结果查询

**接口路径**: `POST /ams/api/v1/merchants/inquiryRegistrationStatus`

**请求头**:

| Header | 说明 |
|--------|------|
| client-id | Antom Client ID |
| Request-Time | 请求时间戳（毫秒） |
| Signature | 签名 |
| Content-Type | application/json |

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| registrationRequestId | String | 否* | 注册请求 ID（与 merchant 二选一） |
| merchant | Object | 否* | 商户标识 |

\* `registrationRequestId` 和 `merchant` 至少传一个

**请求示例**:
```json
{
  "registrationRequestId": "REG_20240115_001"
}
```

或使用商户标识查询：
```json
{
  "merchant": {
    "integrationPartnerId": "2188120272582435",
    "referenceMerchantId": "MERCHANT_001"
  }
}
```

**响应示例**:
```json
{
  "result": {
    "resultStatus": "S",
    "resultCode": "SUCCESS",
    "resultMessage": "success"
  },
  "registrationResult": {
    "registrationStatus": "SUCCESS",
    "registrationRequestId": "REG_20240115_001",
    "loginId": "merchant@example.com",
    "parentMerchantId": "2188120272582435",
    "referenceMerchantId": "MERCHANT_001"
  }
}
```

**状态说明**:

| 状态 | 说明 |
|------|------|
| PROCESSING | 处理中 |
| SUCCESS | 入驻成功 |
| FAIL | 入驻失败 |

**失败响应示例**:
```json
{
  "result": {
    "resultStatus": "S",
    "resultCode": "SUCCESS"
  },
  "registrationResult": {
    "registrationStatus": "FAIL",
    "registrationRequestId": "REG_20240115_001",
    "failReasonType": "KYC_REJECTED",
    "failReasonDescription": "Business license is invalid"
  }
}
```

---

### 3.6 入驻结果通知（回调）

**接口路径**: `POST {your_callback_url}/register/notification`

**说明**: 此接口由甲方实现，Antom 在入驻状态变更时异步回调。

**请求头**:

| Header | 说明 |
|--------|------|
| client-id | Antom Client ID |
| Request-Time | 请求时间戳（毫秒） |
| Signature | 签名（需验证） |
| Content-Type | application/json |

**通知体结构**:

| 参数 | 类型 | 说明 |
|------|------|------|
| notifyId | String | 唯一通知 ID（用于幂等处理） |
| notificationType | String | 通知类型 |
| registrationRequestId | String | 注册请求 ID |
| merchantRegistrationResult | Object | 注册结果（REGISTRATION_STATUS 类型） |
| paymentMethodType | String | 支付方式类型（PAYMENT_METHOD_ACTIVATION_STATUS 类型） |
| paymentMethodStatus | String | 支付方式状态 |
| riskLevel | String | 风险等级（RISK_NOTIFICATION 类型） |
| riskReasonCodes | Array | 风险原因码 |

**通知类型**:

| 类型 | 说明 |
|------|------|
| REGISTRATION_STATUS | 入驻状态变更 |
| PAYMENT_METHOD_ACTIVATION_STATUS | 支付方式激活状态变更 |
| RISK_NOTIFICATION | 风险通知 |

**通知示例（入驻成功）**:
```json
{
  "notifyId": "NOTIFY_20240115_001",
  "notificationType": "REGISTRATION_STATUS",
  "registrationRequestId": "REG_20240115_001",
  "merchantRegistrationResult": {
    "registrationStatus": "SUCCESS",
    "registrationRequestId": "REG_20240115_001",
    "parentMerchantId": "2188120272582435",
    "referenceMerchantId": "MERCHANT_001"
  }
}
```

**通知示例（入驻失败）**:
```json
{
  "notifyId": "NOTIFY_20240115_002",
  "notificationType": "REGISTRATION_STATUS",
  "registrationRequestId": "REG_20240115_001",
  "merchantRegistrationResult": {
    "registrationStatus": "FAIL",
    "registrationRequestId": "REG_20240115_001",
    "failReasonType": "KYC_REJECTED",
    "failReasonDescription": "The uploaded business license has expired"
  }
}
```

**通知示例（支付方式激活）**:
```json
{
  "notifyId": "NOTIFY_20240115_003",
  "notificationType": "PAYMENT_METHOD_ACTIVATION_STATUS",
  "registrationRequestId": "REG_20240115_001",
  "paymentMethodType": "VISA",
  "paymentMethodStatus": "ACTIVE"
}
```

**通知示例（风险通知）**:
```json
{
  "notifyId": "NOTIFY_20240115_004",
  "notificationType": "RISK_NOTIFICATION",
  "registrationRequestId": "REG_20240115_001",
  "riskLevel": "MEDIUM",
  "riskReasonCodes": ["R001", "R005"]
}
```

**必须返回的响应格式**:
```json
{
  "result": {
    "resultCode": "SUCCESS",
    "resultValue": "S",
    "message": "success"
  }
}
```

**处理逻辑建议**:

```javascript
async function handleNotification(req, res) {
  const { notifyId, notificationType, ...data } = req.body;

  // 1. 幂等性检查
  const existing = await findNotificationByNotifyId(notifyId);
  if (existing) {
    return res.json({ result: { resultCode: "SUCCESS", resultValue: "S", message: "success" }});
  }

  // 2. 保存通知记录
  await saveNotification(notifyId, notificationType, data);

  // 3. 根据类型处理
  switch (notificationType) {
    case 'REGISTRATION_STATUS':
      await handleRegistrationResult(data.merchantRegistrationResult);
      break;
    case 'PAYMENT_METHOD_ACTIVATION_STATUS':
      await handlePaymentMethodActivation(data);
      break;
    case 'RISK_NOTIFICATION':
      await handleRiskNotification(data);
      break;
  }

  // 4. 返回成功响应
  res.json({ result: { resultCode: "SUCCESS", resultValue: "S", message: "success" }});
}
```

---

## 四、签名机制

### 4.1 签名算法

采用 `SHA256withRSA` 算法进行签名和验签。

### 4.2 请求签名流程

**Step 1: 构造待签名内容**

```
content_to_be_signed = "POST <http_uri>\n<client-id>.<request-time>.<request-body>"
```

示例：
```
POST /ams/api/v1/merchant/register
SANDBOX_5X00000000000000.1685599933871.{"registrationRequestId":"REG_001",...}
```

**Step 2: 生成签名**

```javascript
const crypto = require('crypto');

function signRequest(httpUri, clientId, requestTime, requestBody, privateKeyBase64) {
  // 1. 构造待签名内容
  const contentToSign = `POST ${httpUri}\n${clientId}.${requestTime}.${requestBody}`;

  // 2. 格式化私钥
  const privateKeyPem = formatPrivateKey(privateKeyBase64);

  // 3. 签名
  const signer = crypto.createSign('SHA256');
  signer.update(contentToSign, 'utf8');
  const base64Signature = signer.sign(privateKeyPem, 'base64');

  // 4. URL 编码
  return encodeURIComponent(base64Signature);
}

function formatPrivateKey(key) {
  if (key.includes('-----BEGIN')) {
    return key;
  }
  return `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
}
```

**Step 3: 构建 Signature 请求头**

```
Signature: algorithm=RSA256,keyVersion=1,signature=<generated_signature>
```

### 4.3 签名验证流程

**Step 1: 提取请求头**

```javascript
const clientId = req.headers['client-id'];
const requestTime = req.headers['request-time'];
const signatureHeader = req.headers['signature'];
```

**Step 2: 解析 Signature 头**

```javascript
function parseSignatureHeader(header) {
  const parts = {};
  header.split(',').forEach(part => {
    const [key, value] = part.split('=');
    parts[key.trim()] = value.trim();
  });
  return parts;
}

const { algorithm, keyVersion, signature } = parseSignatureHeader(signatureHeader);
```

**Step 3: 验证签名**

```javascript
function verifySignature(httpUri, clientId, requestTime, rawBody, signature, publicKeyBase64) {
  // 1. 构造待验证内容
  const contentToVerify = `POST ${httpUri}\n${clientId}.${requestTime}.${rawBody}`;

  // 2. 格式化公钥
  const publicKeyPem = formatPublicKey(publicKeyBase64);

  // 3. 验证签名
  const verifier = crypto.createVerify('SHA256');
  verifier.update(contentToVerify, 'utf8');
  return verifier.verify(publicKeyPem, Buffer.from(signature, 'base64'));
}
```

> **重要**: 验签时必须使用原始请求体（raw body），不能使用 JSON.parse 后的对象重新序列化，否则会导致验签失败。

### 4.4 密钥格式

支持的密钥格式：

| 格式 | 标识 |
|------|------|
| PKCS#8 私钥 | `-----BEGIN PRIVATE KEY-----` |
| PKCS#1 私钥 | `-----BEGIN RSA PRIVATE KEY-----` |
| X.509 公钥 | `-----BEGIN PUBLIC KEY-----` |
| PKCS#1 公钥 | `-----BEGIN RSA PUBLIC KEY-----` |

---

## 五、配置项

### 5.1 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `ANTOM_CLIENT_ID` | Antom Client ID | `5J5YHR5W2YBU9403103` |
| `ANTOM_PRIVATE_KEY` | Antom 私钥（Base64） | `MIIEvgIBADANBg...` |
| `ANTOM_PUBLIC_KEY` | Antom 公钥（Base64） | `MIIBIjANBgkqhk...` |
| `ANTOM_BASE_URL` | Antom API 地址 | `https://open-sea-global.alipay.com` |
| `ANTOM_SANDBOX` | 是否沙箱环境 | `true` / `false` |
| `WF_CLIENT_ID` | WorldFirst Client ID | `WF_APP_xxxxx` |
| `WF_PRIVATE_KEY` | WorldFirst 私钥 | `MIIEvgIBADANBg...` |
| `PARENT_MERCHANT_ID` | 父商户 ID | `2188120272582435` |
| `DEFAULT_SETTLEMENT_CURRENCY` | 默认结算币种 | `HKD` |
| `NOTIFY_CALLBACK_URL` | 回调通知 URL | `https://your-domain.com/register/notification` |

### 5.2 API 地址

**生产环境**:
`https://open-sea-global.alipay.com`
---

## 六、错误处理

### 6.1 ResultStatus 说明

| 状态 | 含义 | 处理方式 |
|------|------|---------|
| `S` | 成功 | 正常继续 |
| `U` | 未知（可重试） | 自动重试，建议最多 3 次，指数退避 |
| `F` | 失败（不可重试） | 终止流程，记录错误信息 |

### 6.2 常见错误码

| 错误码 | 说明 | 处理建议 |
|--------|------|---------|
| `INVALID_AUTH_CODE` | 授权码无效或过期 | 重新发起授权流程 |
| `INVALID_ACCESS_TOKEN` | 访问令牌无效 | 重新获取 Token |
| `INVALID_SIGNATURE` | 签名验证失败 | 检查签名算法和密钥 |
| `MERCHANT_ALREADY_EXISTS` | 商户已存在 | 使用已有商户或更换 referenceMerchantId |
| `KYC_INCOMPLETE` | KYC 信息不完整 | 补充 KYC 信息 |
| `INVALID_CERTIFICATE` | 证书无效 | 检查营业执照等文件 |

### 6.3 重试机制

```javascript
async function callWithRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (result.resultStatus !== 'U') {
        return result;
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }

    // 指数退避
    const delay = baseDelayMs * Math.pow(2, attempt);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

---

## 七、注意事项

### 7.1 幂等性

以下 ID 需要保证幂等性：

| ID 类型 | 说明 |
|---------|------|
| `registrationRequestId` | 注册请求幂等 ID |
| `offboardingRequestId` | 下线请求幂等 ID |
| `notifyId` | 通知幂等 ID |

相同 ID + 终态会返回相同结果。

### 7.2 回调地址配置

回调地址需要在 Antom 后台预先配置，确保：
1. 域名已备案（生产环境）
2. 支持 HTTPS
3. 支持 POST 请求
4. 能够正确验证签名

### 7.3 文件上传

证书、门店照片等文件需要先上传至可访问的 URL，然后在请求中传递 URL。建议：
1. 使用 CDN 或对象存储
2. 确保 URL 可公网访问
3. 文件格式支持 PDF、JPG、PNG

### 7.4 商户状态

商户状态变更条件：
- `ACTIVE`: `kycStatus = APPROVED` 且至少一个支付方式 `status = ACTIVE`
- `INACTIVE`: 初始状态或 KYC 未通过
- `OFFBOARDED`: 已下线

---

## 八、测试与调试

### 8.1 沙箱环境

使用沙箱环境进行测试：
1. 设置 `ANTOM_SANDBOX=true`
2. API 路径自动添加 `/sandbox/` 前缀
3. 使用沙箱测试账号

### 8.2 签名调试

签名失败常见原因：
1. 请求体序列化顺序不一致
2. 时间戳格式错误（应为毫秒）
3. URL 编码问题
4. 密钥格式错误

调试建议：
```javascript
console.log('Content to sign:', contentToSign);
console.log('Signature header:', signatureHeader);
```

### 8.3 回调测试

可使用 Mock 工具模拟回调：
```bash
curl -X POST https://your-domain.com/register/notification \
  -H "Content-Type: application/json" \
  -H "client-id: YOUR_CLIENT_ID" \
  -H "Request-Time: $(date +%s%3N)" \
  -H "Signature: algorithm=RSA256,keyVersion=1,signature=xxx" \
  -d '{
    "notifyId": "TEST_NOTIFY_001",
    "notificationType": "REGISTRATION_STATUS",
    "registrationRequestId": "REG_TEST_001",
    "merchantRegistrationResult": {
      "registrationStatus": "SUCCESS"
    }
  }'
```

---

## 九、附录

### 9.1 支持的支付方式

| 支付方式 | 说明 |
|---------|------|
| VISA | Visa 卡 |
| MASTERCARD | Mastercard 卡 |
| ALIPAY_HK | 支付宝香港 |
| PAYNOW | PayNow（新加坡） |
| FPS | 转数快（香港） |

### 9.2 地区代码

常用地区代码：

| 代码 | 地区 |
|------|------|
| CN | 中国大陆 |
| HK | 香港 |
| SG | 新加坡 |
| MY | 马来西亚 |
| US | 美国 |

### 9.3 MCC 码

常用 MCC 码：

| MCC | 说明 |
|-----|------|
| 5734 | 计算机软件商店 |
| 5814 | 快餐店 |
| 5942 | 书店 |
| 5999 | 其他零售店 |

---

## 十、联系与支持

如有集成问题，请联系 Antom 技术支持团队。