/**
 * Database Maintenance Script
 * 数据库运维脚本
 * 
 * Usage:
 *   npx tsx scripts/db-maintenance.ts <command> [options]
 * 
 * Commands:
 *   list                              列出所有商户
 *   stats                             统计数据概览
 *   get <merchantId>                  查看商户详情
 * 
 *   status <merchantId> <status>      修改商户状态 (ACTIVE/INACTIVE/OFFBOARDED)
 *   kyc <merchantId> <kycStatus>      修改商户KYC状态 (PENDING/APPROVED/REJECTED/SUPPLEMENT_REQUIRED)
 *   risk <merchantId> <level> [codes] 修改商户风险等级 (LOW/MEDIUM/HIGH) 和原因码
 * 
 *   delete <merchantId> [--hard]      删除商户 (默认软删除=设置OFFBOARDED, --hard=物理删除)
 *   clear-test                        清理测试商户 (email包含test或shopName包含测试)
 *   clear-offboarded                  清理已下线商户 (status=OFFBOARDED)
 *   clear-notifications [days]        清理N天前的通知 (默认30天)
 * 
 *   reset-kyc <merchantId>            重置商户KYC状态为PENDING
 *   activate-pm <pmId>                激活支付方式
 *   deactivate-pm <pmId>              停用支付方式
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ANSI颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

// ============ 查询功能 ============

async function listMerchants() {
  log('cyan', '\n📋 Merchant List\n');
  
  const merchants = await prisma.merchant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { paymentMethods: true, _count: { select: { notifications: true } } },
  });

  if (merchants.length === 0) {
    log('yellow', 'No merchants found.');
    return;
  }

  console.log(
    'ID'.padEnd(36) +
    'Shop Name'.padEnd(25) +
    'Status'.padEnd(12) +
    'KYC Status'.padEnd(20) +
    'Risk'.padEnd(10) +
    'PMs'.padEnd(6) +
    'Notifications'
  );
  console.log('-'.repeat(130));

  for (const m of merchants) {
    const statusColor = m.status === 'ACTIVE' ? 'green' : 'red';
    const kycColor = m.kycStatus === 'APPROVED' ? 'green' : 
                     m.kycStatus === 'REJECTED' ? 'red' : 
                     m.kycStatus === 'SUPPLEMENT_REQUIRED' ? 'yellow' : 'gray';
    const riskColor = m.riskLevel === 'HIGH' ? 'red' : 
                      m.riskLevel === 'MEDIUM' ? 'yellow' : 'green';

    const riskStr = m.riskLevel 
      ? `${colors[riskColor]}${m.riskLevel}${colors.reset}` 
      : '-';
    const riskPadExtra = m.riskLevel ? colors[riskColor].length + colors.reset.length : 0;

    console.log(
      m.id.padEnd(36) +
      m.shopName.substring(0, 22).padEnd(25) +
      `${colors[statusColor]}${m.status}${colors.reset}`.padEnd(12 + colors[statusColor].length + colors.reset.length) +
      `${colors[kycColor]}${m.kycStatus}${colors.reset}`.padEnd(20 + colors[kycColor].length + colors.reset.length) +
      riskStr.padEnd(10 + riskPadExtra) +
      String(m.paymentMethods.length).padEnd(6) +
      String(m._count.notifications)
    );
  }

  log('green', `\nTotal: ${merchants.length} merchants\n`);
}

async function showStats() {
  log('cyan', '\n📊 Database Statistics\n');

  const [merchantStats, kycStats, pmStats, notificationStats] = await Promise.all([
    // 商户统计
    prisma.merchant.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    // KYC状态统计
    prisma.merchant.groupBy({
      by: ['kycStatus'],
      _count: { id: true },
    }),
    // 支付方式统计
    prisma.paymentMethod.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    // 通知统计
    prisma.notification.count(),
  ]);

  console.log('Merchant Status:');
  for (const s of merchantStats) {
    console.log(`  ${s.status}: ${s._count.id}`);
  }

  console.log('\nKYC Status:');
  for (const s of kycStats) {
    console.log(`  ${s.kycStatus}: ${s._count.id}`);
  }

  console.log('\nPayment Methods:');
  for (const s of pmStats) {
    console.log(`  ${s.status}: ${s._count.id}`);
  }

  console.log(`\nTotal Notifications: ${notificationStats}`);

  // 风险等级统计
  const riskStats = await prisma.merchant.groupBy({
    by: ['riskLevel'],
    _count: { id: true },
  });
  
  console.log('\nRisk Level:');
  for (const s of riskStats) {
    console.log(`  ${s.riskLevel || 'NULL'}: ${s._count.id}`);
  }

  console.log('');
}

async function getMerchant(merchantId: string) {
  log('cyan', `\n🔍 Merchant Details: ${merchantId}\n`);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      kycInfo: true,
      paymentMethods: { orderBy: { createdAt: 'asc' } },
      entityAssociations: { orderBy: { createdAt: 'asc' } },
      _count: { select: { notifications: true } },
    },
  });

  if (!merchant) {
    log('red', `Merchant not found: ${merchantId}`);
    return;
  }

  console.log('Basic Info:');
  console.log(`  ID:                    ${merchant.id}`);
  console.log(`  Shop Name:             ${merchant.shopName}`);
  console.log(`  Email:                 ${merchant.email}`);
  console.log(`  Region:                ${merchant.region}`);
  console.log(`  Status:                ${merchant.status}`);
  console.log(`  KYC Status:            ${merchant.kycStatus}`);
  console.log(`  Risk Level:            ${merchant.riskLevel || '-'}`);
  console.log(`  Risk Reason Codes:     ${merchant.riskReasonCodes || '-'}`);
  console.log(`  WF Account ID:         ${merchant.wfAccountId || '-'}`);
  console.log(`  Reference Merchant ID: ${merchant.referenceMerchantId || '-'}`);
  console.log(`  Settlement Currency:   ${merchant.settlementCurrency}`);
  console.log(`  Registration Req ID:   ${merchant.registrationRequestId || '-'}`);
  console.log(`  Offboarding Req ID:    ${merchant.offboardingRequestId || '-'}`);
  console.log(`  Created At:            ${formatDateTime(merchant.createdAt)}`);
  console.log(`  Updated At:            ${formatDateTime(merchant.updatedAt)}`);

  if (merchant.kycInfo) {
    console.log('\nKYC Info:');
    console.log(`  Legal Name:        ${merchant.kycInfo.legalName || '-'}`);
    console.log(`  Company Type:      ${merchant.kycInfo.companyType || '-'}`);
    console.log(`  Certificate Type:  ${merchant.kycInfo.certificateType || '-'}`);
    console.log(`  Certificate No:    ${merchant.kycInfo.certificateNo || '-'}`);
    console.log(`  MCC:               ${merchant.kycInfo.mcc || '-'}`);
    console.log(`  Website:           ${merchant.kycInfo.websiteUrl || '-'}`);
    console.log(`  Contact:           ${merchant.kycInfo.contactInfo || '-'}`);
    console.log(`  Rejected Fields:   ${merchant.kycInfo.rejectedFields || '-'}`);
  }

  if (merchant.paymentMethods.length > 0) {
    console.log('\nPayment Methods:');
    for (const pm of merchant.paymentMethods) {
      const statusStr = pm.status === 'ACTIVE' ? `${colors.green}${pm.status}${colors.reset}` :
                        pm.status === 'INACTIVE' ? `${colors.red}${pm.status}${colors.reset}` :
                        `${colors.yellow}${pm.status}${colors.reset}`;
      console.log(`  - ${pm.paymentMethodType}: ${statusStr}`);
      console.log(`    ID: ${pm.id}`);
      if (pm.activatedAt) console.log(`    Activated: ${formatDateTime(pm.activatedAt)}`);
      if (pm.deactivatedAt) console.log(`    Deactivated: ${formatDateTime(pm.deactivatedAt)}`);
    }
  }

  if (merchant.entityAssociations.length > 0) {
    console.log('\nEntity Associations:');
    for (const ea of merchant.entityAssociations) {
      console.log(`  - ${ea.associationType}: ${ea.fullName || `${ea.firstName} ${ea.lastName}`}`);
      if (ea.shareholdingRatio) console.log(`    Share: ${ea.shareholdingRatio}`);
    }
  }

  console.log(`\nNotifications: ${merchant._count.notifications}`);
  console.log('');
}

// ============ 状态修改功能 ============

const VALID_STATUS = ['ACTIVE', 'INACTIVE', 'OFFBOARDED'] as const;
const VALID_KYC_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'SUPPLEMENT_REQUIRED'] as const;
const VALID_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

async function updateMerchantStatus(merchantId: string, status: string) {
  if (!VALID_STATUS.includes(status as typeof VALID_STATUS[number])) {
    log('red', `Invalid status. Valid values: ${VALID_STATUS.join(', ')}`);
    return;
  }

  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status },
  });

  log('green', `✓ Merchant ${merchant.shopName} status updated to ${status}`);
}

async function updateKycStatus(merchantId: string, kycStatus: string) {
  if (!VALID_KYC_STATUS.includes(kycStatus as typeof VALID_KYC_STATUS[number])) {
    log('red', `Invalid KYC status. Valid values: ${VALID_KYC_STATUS.join(', ')}`);
    return;
  }

  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data: { kycStatus },
  });

  log('green', `✓ Merchant ${merchant.shopName} KYC status updated to ${kycStatus}`);
}

async function updateRiskLevel(merchantId: string, riskLevel: string, reasonCodes?: string) {
  if (!VALID_RISK_LEVELS.includes(riskLevel as typeof VALID_RISK_LEVELS[number])) {
    log('red', `Invalid risk level. Valid values: ${VALID_RISK_LEVELS.join(', ')}`);
    return;
  }

  const updateData: { riskLevel: string; riskReasonCodes?: string } = { riskLevel };
  if (reasonCodes) {
    updateData.riskReasonCodes = JSON.stringify(reasonCodes.split(',').map(c => c.trim()));
  }

  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data: updateData,
  });

  log('green', `✓ Merchant ${merchant.shopName} risk level updated to ${riskLevel}`);
  if (reasonCodes) {
    log('gray', `  Reason codes: ${reasonCodes}`);
  }
}

async function resetKycStatus(merchantId: string) {
  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data: { 
      kycStatus: 'PENDING',
      registrationRequestId: null,
    },
  });

  // 重置KYC信息的rejected fields
  await prisma.kycInfo.updateMany({
    where: { merchantId },
    data: { rejectedFields: null },
  });

  // 重置支付方式状态
  await prisma.paymentMethod.updateMany({
    where: { merchantId },
    data: { status: 'PENDING', activatedAt: null, deactivatedAt: null },
  });

  log('green', `✓ Merchant ${merchant.shopName} KYC status reset to PENDING`);
}

// ============ 删除/清理功能 ============

async function deleteMerchant(merchantId: string, hard: boolean = false) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { 
      kycInfo: true,
      _count: { 
        select: { 
          paymentMethods: true, 
          notifications: true, 
          entityAssociations: true,
        } 
      } 
    },
  });

  if (!merchant) {
    log('red', `Merchant not found: ${merchantId}`);
    return;
  }

  log('yellow', `\n⚠️  About to delete merchant:`);
  console.log(`  Shop Name:    ${merchant.shopName}`);
  console.log(`  Email:        ${merchant.email}`);
  console.log(`  Status:       ${merchant.status}`);
  console.log(`  KYC Status:   ${merchant.kycStatus}`);
  console.log(`  Related Data:`);
  console.log(`    - KYC Info:        ${merchant.kycInfo ? 'Yes' : 'No'}`);
  console.log(`    - Payment Methods: ${merchant._count.paymentMethods}`);
  console.log(`    - Notifications:   ${merchant._count.notifications}`);
  console.log(`    - Entity Assocs:   ${merchant._count.entityAssociations}`);

  if (hard) {
    log('red', '\n🔴 HARD DELETE - This will permanently remove all data!');

    // 按外键依赖顺序删除
    await prisma.notification.deleteMany({ where: { merchantId } });
    await prisma.paymentMethod.deleteMany({ where: { merchantId } });
    await prisma.entityAssociation.deleteMany({ where: { merchantId } });
    await prisma.kycInfo.deleteMany({ where: { merchantId } });
    await prisma.merchant.delete({ where: { id: merchantId } });

    log('green', `✓ Merchant ${merchant.shopName} permanently deleted`);
  } else {
    log('yellow', '\n🟡 SOFT DELETE - Setting status to OFFBOARDED');

    await prisma.merchant.update({
      where: { id: merchantId },
      data: { status: 'OFFBOARDED' },
    });

    log('green', `✓ Merchant ${merchant.shopName} status set to OFFBOARDED`);
  }
}

async function clearTestMerchants() {
  log('cyan', '\n🧹 Clearing test merchants...\n');

  const testMerchants = await prisma.merchant.findMany({
    where: {
      OR: [
        { email: { contains: 'test' } },
        { email: { contains: 'demo' } },
        { shopName: { contains: 'test' } },
        { shopName: { contains: '测试' } },
        { shopName: { contains: 'demo' } },
      ],
    },
  });

  if (testMerchants.length === 0) {
    log('green', 'No test merchants found.');
    return;
  }

  log('yellow', `Found ${testMerchants.length} test merchants:`);
  for (const m of testMerchants) {
    console.log(`  - ${m.shopName} (${m.email})`);
  }

  for (const m of testMerchants) {
    await prisma.notification.deleteMany({ where: { merchantId: m.id } });
    await prisma.paymentMethod.deleteMany({ where: { merchantId: m.id } });
    await prisma.entityAssociation.deleteMany({ where: { merchantId: m.id } });
    await prisma.kycInfo.deleteMany({ where: { merchantId: m.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }

  log('green', `✓ Cleared ${testMerchants.length} test merchants`);
}

async function clearOffboardedMerchants() {
  log('cyan', '\n🧹 Clearing offboarded merchants...\n');

  const offboardedMerchants = await prisma.merchant.findMany({
    where: { status: 'OFFBOARDED' },
  });

  if (offboardedMerchants.length === 0) {
    log('green', 'No offboarded merchants found.');
    return;
  }

  log('yellow', `Found ${offboardedMerchants.length} offboarded merchants:`);
  for (const m of offboardedMerchants) {
    console.log(`  - ${m.shopName} (${m.email})`);
  }

  for (const m of offboardedMerchants) {
    await prisma.notification.deleteMany({ where: { merchantId: m.id } });
    await prisma.paymentMethod.deleteMany({ where: { merchantId: m.id } });
    await prisma.entityAssociation.deleteMany({ where: { merchantId: m.id } });
    await prisma.kycInfo.deleteMany({ where: { merchantId: m.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }

  log('green', `✓ Cleared ${offboardedMerchants.length} offboarded merchants`);
}

async function clearOldNotifications(days: number = 30) {
  log('cyan', `\n🧹 Clearing notifications older than ${days} days...\n`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await prisma.notification.deleteMany({
    where: {
      processedAt: { lt: cutoffDate },
    },
  });

  log('green', `✓ Deleted ${result.count} old notifications`);
}

// ============ 支付方式管理 ============

async function activatePaymentMethod(pmId: string) {
  const pm = await prisma.paymentMethod.update({
    where: { id: pmId },
    data: { status: 'ACTIVE', activatedAt: new Date(), deactivatedAt: null },
    include: { merchant: true },
  });

  log('green', `✓ Payment method ${pm.paymentMethodType} activated for ${pm.merchant.shopName}`);
}

async function deactivatePaymentMethod(pmId: string) {
  const pm = await prisma.paymentMethod.update({
    where: { id: pmId },
    data: { status: 'INACTIVE', deactivatedAt: new Date() },
    include: { merchant: true },
  });

  log('green', `✓ Payment method ${pm.paymentMethodType} deactivated for ${pm.merchant.shopName}`);
}

// ============ 主程序 ============

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
${colors.cyan}Database Maintenance Script${colors.reset}

Usage: npx tsx scripts/db-maintenance.ts <command> [options]

${colors.yellow}Query Commands:${colors.reset}
  list                              列出所有商户
  stats                             统计数据概览
  get <merchantId>                  查看商户详情

${colors.yellow}Status Commands:${colors.reset}
  status <merchantId> <status>      修改商户状态 (ACTIVE/INACTIVE/OFFBOARDED)
  kyc <merchantId> <kycStatus>      修改KYC状态 (PENDING/APPROVED/REJECTED/SUPPLEMENT_REQUIRED)
  risk <merchantId> <level> [codes] 修改风险等级 (LOW/MEDIUM/HIGH) 和原因码(逗号分隔)
  reset-kyc <merchantId>            重置商户KYC状态

${colors.yellow}Delete Commands:${colors.reset}
  delete <merchantId>               软删除商户 (设置OFFBOARDED)
  delete <merchantId> --hard        物理删除商户及关联数据
  clear-test                        清理测试商户
  clear-offboarded                  清理已下线商户
  clear-notifications [days]        清理N天前的通知 (默认30天)

${colors.yellow}Payment Method Commands:${colors.reset}
  activate-pm <pmId>                激活支付方式
  deactivate-pm <pmId>              停用支付方式
`);
    return;
  }

  try {
    switch (command) {
      case 'list':
        await listMerchants();
        break;
      case 'stats':
        await showStats();
        break;
      case 'get':
        if (!args[1]) { log('red', 'Usage: get <merchantId>'); break; }
        await getMerchant(args[1]);
        break;
      case 'status':
        if (!args[1] || !args[2]) { log('red', 'Usage: status <merchantId> <status>'); break; }
        await updateMerchantStatus(args[1], args[2]);
        break;
      case 'kyc':
        if (!args[1] || !args[2]) { log('red', 'Usage: kyc <merchantId> <kycStatus>'); break; }
        await updateKycStatus(args[1], args[2]);
        break;
      case 'risk':
        if (!args[1] || !args[2]) { log('red', 'Usage: risk <merchantId> <level> [codes]'); break; }
        await updateRiskLevel(args[1], args[2], args[3]);
        break;
      case 'reset-kyc':
        if (!args[1]) { log('red', 'Usage: reset-kyc <merchantId>'); break; }
        await resetKycStatus(args[1]);
        break;
      case 'delete':
        if (!args[1]) { log('red', 'Usage: delete <merchantId> [--hard]'); break; }
        await deleteMerchant(args[1], args.includes('--hard'));
        break;
      case 'clear-test':
        await clearTestMerchants();
        break;
      case 'clear-offboarded':
        await clearOffboardedMerchants();
        break;
      case 'clear-notifications':
        await clearOldNotifications(parseInt(args[1]) || 30);
        break;
      case 'activate-pm':
        if (!args[1]) { log('red', 'Usage: activate-pm <pmId>'); break; }
        await activatePaymentMethod(args[1]);
        break;
      case 'deactivate-pm':
        if (!args[1]) { log('red', 'Usage: deactivate-pm <pmId>'); break; }
        await deactivatePaymentMethod(args[1]);
        break;
      default:
        log('red', `Unknown command: ${command}`);
        log('gray', 'Run without arguments to see available commands');
    }
  } catch (error) {
    log('red', `Error: ${(error as Error).message}`);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
