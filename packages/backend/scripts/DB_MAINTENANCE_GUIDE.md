# 数据库运维脚本使用指南

## 快速开始

```bash
cd packages/backend

# 查看所有可用命令
npm run db:admin
```

---

## 命令详解

### 一、查询类命令

#### 1. 列出所有商户
```bash
npm run db:admin list
```
显示商户列表，包括ID、店铺名、状态、KYC状态、风险等级等信息。

#### 2. 统计数据概览
```bash
npm run db:admin stats
```
显示数据库统计信息：
- 商户状态分布
- KYC状态分布
- 支付方式状态分布
- 风险等级分布
- 通知总数

#### 3. 查看商户详情
```bash
npm run db:admin get <merchantId>
```
显示单个商户的完整信息，包括：
- 基本信息
- KYC信息
- 支付方式列表
- 关联实体（董事/股东）
- 通知数量

---

### 二、状态修改命令

#### 1. 修改商户状态
```bash
npm run db:admin status <merchantId> <status>
```
| status | 说明 |
|--------|------|
| `ACTIVE` | 激活状态 |
| `OFFBOARDED` | 已下线 |

**示例：**
```bash
npm run db:admin status abc-123 ACTIVE
npm run db:admin status abc-123 OFFBOARDED
```

#### 2. 修改KYC状态
```bash
npm run db:admin kyc <merchantId> <kycStatus>
```
| kycStatus | 说明 |
|-----------|------|
| `PENDING` | 待审核 |
| `APPROVED` | 已通过 |
| `REJECTED` | 已拒绝 |
| `SUPPLEMENT_REQUIRED` | 需补充材料 |

**示例：**
```bash
npm run db:admin kyc abc-123 APPROVED
```

#### 3. 修改风险等级
```bash
npm run db:admin risk <merchantId> <level> [reasonCodes]
```
| level | 说明 |
|-------|------|
| `LOW` | 低风险 |
| `MEDIUM` | 中风险 |
| `HIGH` | 高风险 |

**示例：**
```bash
# 设置高风险，带原因码
npm run db:admin risk abc-123 HIGH R001,R002,R003

# 设置低风险
npm run db:admin risk abc-123 LOW
```

#### 4. 重置KYC状态
```bash
npm run db:admin reset-kyc <merchantId>
```
执行操作：
- KYC状态重置为 PENDING
- 清除注册请求ID
- 清除KYC驳回字段
- 重置所有支付方式为 PENDING

---

### 三、删除/清理命令

#### 1. 软删除商户
```bash
npm run db:admin delete <merchantId>
```
仅将商户状态设为 `OFFBOARDED`，保留所有数据。

#### 2. 物理删除商户
```bash
npm run db:admin delete <merchantId> --hard
```
**⚠️ 危险操作** - 永久删除商户及所有关联数据：
- 通知记录
- 支付方式
- 关联实体
- KYC信息
- 商户主记录

#### 3. 清理测试商户
```bash
npm run db:admin clear-test
```
删除符合条件的测试商户：
- 邮箱包含 `test` 或 `demo`
- 店铺名包含 `test`、`测试` 或 `demo`

#### 4. 清理已下线商户
```bash
npm run db:admin clear-offboarded
```
删除所有 `status = OFFBOARDED` 的商户。

#### 5. 清理过期通知
```bash
npm run db:admin clear-notifications [days]
```
删除指定天数前的通知记录，默认30天。

**示例：**
```bash
# 清理30天前的通知（默认）
npm run db:admin clear-notifications

# 清理7天前的通知
npm run db:admin clear-notifications 7

# 清理90天前的通知
npm run db:admin clear-notifications 90
```

---

### 四、支付方式管理

#### 1. 激活支付方式
```bash
npm run db:admin activate-pm <paymentMethodId>
```
将支付方式状态设为 `ACTIVE`，并记录激活时间。

#### 2. 停用支付方式
```bash
npm run db:admin deactivate-pm <paymentMethodId>
```
将支付方式状态设为 `INACTIVE`，并记录停用时间。

---

## 常见操作场景

### 场景1：商户审核通过后手动激活
```bash
# 1. 查看商户详情
npm run db:admin get <merchantId>

# 2. 更新KYC状态
npm run db:admin kyc <merchantId> APPROVED

# 3. 激活支付方式（如果需要）
npm run db:admin activate-pm <paymentMethodId>
```

### 场景2：商户风险预警处理
```bash
# 1. 设置风险等级
npm run db:admin risk <merchantId> HIGH R001,R005

# 2. 可选：停用支付方式
npm run db:admin deactivate-pm <paymentMethodId>
```

### 场景3：商户要求注销
```bash
# 软删除（推荐）
npm run db:admin delete <merchantId>

# 或物理删除（确认无争议后）
npm run db:admin delete <merchantId> --hard
```

### 场景4：测试环境数据清理
```bash
# 清理测试商户
npm run db:admin clear-test

# 清理过期通知
npm run db:admin clear-notifications 7
```

### 场景5：商户需要重新提交KYC
```bash
npm run db:admin reset-kyc <merchantId>
```

---

## 数据库表结构参考

```
┌─────────────┐       1:1       ┌─────────────┐
│  Merchant   │────────────────►│  KycInfo    │
│             │                 │             │
│  status     │       1:N       │  legalName  │
│  kycStatus  │────────────────►└─────────────┘
│  riskLevel  │       1:N       ┌─────────────┐
│             │────────────────►│PaymentMethod│
└─────────────┘       1:N       └─────────────┘
                                ┌─────────────┐
                                │Notification │
                                └─────────────┘
```

### Merchant 表字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| shopName | VARCHAR | 店铺名称 |
| email | VARCHAR | 商户邮箱 |
| region | VARCHAR | 地区 (CN/SG/HK等) |
| status | ENUM | ACTIVE/OFFBOARDED |
| kycStatus | ENUM | PENDING/APPROVED/REJECTED/SUPPLEMENT_REQUIRED |
| riskLevel | VARCHAR | LOW/MEDIUM/HIGH |
| riskReasonCodes | JSON | 风险原因码数组 |
| wfAccountId | VARCHAR | WF账户ID |
| settlementCurrency | VARCHAR | 结算货币 |

---

## 注意事项

1. **生产环境操作需谨慎**
   - 使用 `--hard` 删除前务必确认
   - 建议先备份数据库

2. **删除操作不可逆**
   - 物理删除会移除所有关联数据
   - 建议优先使用软删除

3. **通知清理**
   - 定期清理过期通知可释放存储空间
   - 建议保留至少30天的通知记录

4. **脚本执行位置**
   - 需在 `packages/backend` 目录下执行
   - 确保 `.env` 文件配置正确的 `DATABASE_URL`
