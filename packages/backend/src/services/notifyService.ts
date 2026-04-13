import { PrismaClient } from '@prisma/client';
import { broadcastToMerchant } from '../websocket';
import type { AntomNotification } from '../types';

const prisma = new PrismaClient();

/**
 * Extract the effective notification type from either `notificationType` (guide spec)
 * or `notifyType` (legacy).
 */
function getNotificationType(notification: AntomNotification): string {
  return notification.notificationType || notification.notifyType || '';
}

/**
 * Extract referenceMerchantId from notification.
 * Different notification types have it in different nested locations.
 */
function getReferenceMerchantId(notification: AntomNotification): string | undefined {
  return (
    (notification as Record<string, unknown>).referenceMerchantId as string ||
    notification.merchantRegistrationResult?.referenceMerchantId ||
    notification.merchantOffboardingResult?.referenceMerchantId ||
    notification.paymentMethodStatusChangeEvent?.merchantId ||
    notification.riskScoreResult?.referenceMerchantId ||
    undefined
  );
}

/**
 * Extract registrationRequestId from either flat field or nested merchantRegistrationResult.
 */
function getRegistrationRequestId(notification: AntomNotification): string | undefined {
  return (
    notification.registrationRequestId ||
    notification.merchantRegistrationResult?.registrationRequestId ||
    notification.paymentMethodStatusChangeEvent?.eventId ||
    undefined
  );
}

/**
 * Extract offboardingRequestId from notification.
 */
function getOffboardingRequestId(notification: AntomNotification): string | undefined {
  return (
    notification.merchantOffboardingResult?.offboardingRequestId ||
    undefined
  );
}

/**
 * Map Antom guide registration status to internal KYC status.
 * Guide uses: SUCCESS / FAIL / PROCESSING
 * Internal uses: APPROVED / REJECTED / SUPPLEMENT_REQUIRED / PENDING
 */
function mapRegistrationStatusToKyc(antomStatus: string): string {
  switch (antomStatus) {
    case 'SUCCESS':
      return 'APPROVED';
    case 'FAIL':
      return 'REJECTED';
    case 'PROCESSING':
      return 'PENDING';
    // Internal-only statuses pass through (for SUPPLEMENT_REQUIRED demo)
    default:
      return antomStatus;
  }
}

export const notifyService = {
  /**
   * Process an incoming notification (from Antom or mock trigger).
   * Supports both guide-format (nested merchantRegistrationResult) and
   * legacy flat format for backward compatibility.
   * Returns true if processed, false if duplicate (idempotent).
   */
  async processNotification(notification: AntomNotification): Promise<boolean> {
    const notificationType = getNotificationType(notification);
    const referenceMerchantId = getReferenceMerchantId(notification);
    const registrationRequestId = getRegistrationRequestId(notification);
    const offboardingRequestId = getOffboardingRequestId(notification);

    // Generate notifyId if not provided by Antom
    // Use referenceMerchantId + notificationType as deterministic key for idempotency
    // For PAYMENT_METHOD_ACTIVATION_STATUS, each eventId has multiple notifications (one per payment method),
    // so we must include paymentMethodType in the key to avoid treating them as duplicates.
    const idempotencyKey = referenceMerchantId || registrationRequestId || offboardingRequestId || String(Date.now());
    const pmTypeSuffix = notificationType === 'PAYMENT_METHOD_ACTIVATION_STATUS'
      ? `_${notification.paymentMethodStatusChangeEvent?.paymentMethodType || notification.paymentMethodDetail?.paymentMethodType || notification.paymentMethodType || 'unknown'}`
      : '';
    const effectiveNotifyId =
      notification.notifyId ||
      `auto_${notificationType}_${idempotencyKey}${pmTypeSuffix}`;

    // Idempotency check
    const existing = await prisma.notification.findUnique({
      where: { notifyId: effectiveNotifyId },
    });
    if (existing) {
      console.log(`[Notify] Duplicate notifyId: ${effectiveNotifyId}, skipping`);
      return false;
    }

    // Find merchant using multiple strategies depending on notification type
    // Strategy 1: by referenceMerchantId (most reliable, present in all notification types)
    let merchant = referenceMerchantId
      ? await prisma.merchant.findFirst({ where: { referenceMerchantId } })
      : null;

    // Strategy 2: by registrationRequestId (REGISTRATION_STATUS / PAYMENT_METHOD_ACTIVATION_STATUS)
    if (!merchant && registrationRequestId) {
      merchant = await prisma.merchant.findFirst({ where: { registrationRequestId } });
    }

    // Strategy 3: by offboardingRequestId (offboard notifications)
    if (!merchant && offboardingRequestId) {
      merchant = await prisma.merchant.findFirst({ where: { offboardingRequestId } });
    }

    if (!merchant) {
      console.error(`[Notify] Merchant not found. referenceMerchantId=${referenceMerchantId}, registrationRequestId=${registrationRequestId}, offboardingRequestId=${offboardingRequestId}`);
      return false;
    }

    // Dispatch by notification type
    switch (notificationType) {
      case 'REGISTRATION_STATUS':
        await handleRegistrationStatus(merchant.id, notification);
        break;
      case 'PAYMENT_METHOD_ACTIVATION_STATUS':
        await handlePaymentMethodActivation(merchant.id, notification);
        break;
      case 'RISK_NOTIFICATION':
      case 'MERCHANT_RISK_SCORE_NOTIFICATION':
        await handleRiskNotification(merchant.id, notification);
        break;
    }

    // Save notification record (handle race condition with unique constraint)
    try {
      await prisma.notification.create({
        data: {
          merchantId: merchant.id,
          notifyId: effectiveNotifyId,
          notificationType: notificationType,
          payload: JSON.stringify(notification),
        },
      });
    } catch (err: unknown) {
      // P2002 = unique constraint violation → duplicate notification (race condition)
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        console.log(`[Notify] Duplicate notifyId (race): ${effectiveNotifyId}, skipping`);
        return false;
      }
      throw err;
    }

    // Push to frontend via WebSocket
    broadcastToMerchant(merchant.id, {
      type: 'NOTIFICATION',
      data: {
        ...notification,
        notificationType,
        merchantId: merchant.id,
        timestamp: new Date().toISOString(),
      },
    });

    return true;
  },
};

/**
 * Evaluate whether the merchant should be ACTIVE.
 * Merchant Status = ACTIVE requires BOTH conditions:
 *   1. kycStatus = APPROVED (REGISTRATION_STATUS notification with registrationStatus=SUCCESS)
 *   2. At least one payment method has status = ACTIVE (PAYMENT_METHOD_ACTIVATION_STATUS notification)
 * If kycStatus is APPROVED but no payment method is ACTIVE yet, merchant stays INACTIVE.
 */
async function evaluateMerchantActiveStatus(merchantId: string): Promise<'ACTIVE' | 'INACTIVE'> {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant || merchant.kycStatus !== 'APPROVED') {
    return 'INACTIVE';
  }

  // Check if at least one payment method is ACTIVE
  const activePaymentMethod = await prisma.paymentMethod.findFirst({
    where: { merchantId, status: 'ACTIVE' },
  });

  return activePaymentMethod ? 'ACTIVE' : 'INACTIVE';
}

async function handleRegistrationStatus(
  merchantId: string,
  notification: AntomNotification
) {
  // Extract registration status from nested result (guide format) or flat field (legacy)
  const antomStatus =
    notification.merchantRegistrationResult?.registrationStatus ||
    notification.registrationStatus ||
    '';

  const kycStatus = mapRegistrationStatusToKyc(antomStatus);

  const updateData: Record<string, unknown> = {
    kycStatus,
  };

  // Save Antom-assigned merchant ID (parentMerchantId in registration result)
  const antomMerchantId = notification.merchantRegistrationResult?.parentMerchantId;
  if (antomMerchantId) {
    updateData.antomMerchantId = antomMerchantId;
  }

  if (kycStatus === 'REJECTED' || kycStatus === 'SUPPLEMENT_REQUIRED') {
    updateData.status = 'INACTIVE';
  }

  // Handle rejected/supplement fields
  if (kycStatus === 'SUPPLEMENT_REQUIRED' && notification.rejectedFields) {
    await prisma.kycInfo.updateMany({
      where: { merchantId },
      data: {
        rejectedFields: JSON.stringify(notification.rejectedFields),
      },
    });
  } else if (kycStatus === 'APPROVED') {
    await prisma.kycInfo.updateMany({
      where: { merchantId },
      data: { rejectedFields: null },
    });
  }

  // First update kycStatus (needed for evaluateMerchantActiveStatus to work correctly)
  await prisma.merchant.update({
    where: { id: merchantId },
    data: updateData,
  });

  // If KYC is APPROVED, evaluate merchant status based on both KYC and payment method conditions
  // Merchant becomes ACTIVE only when kycStatus=APPROVED AND at least one payment method is ACTIVE
  if (kycStatus === 'APPROVED') {
    const merchantStatus = await evaluateMerchantActiveStatus(merchantId);
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { status: merchantStatus },
    });
    console.log(`[Notify] Registration status for merchant ${merchantId}: ${antomStatus} -> kycStatus=${kycStatus}, merchantStatus=${merchantStatus}`);
  } else {
    console.log(`[Notify] Registration status for merchant ${merchantId}: ${antomStatus} -> kycStatus=${kycStatus}`);
  }
}

/**
 * Map Antom payment method currentStatus to internal PaymentMethod status.
 * Antom uses: SUCCESS / FAIL / PROCESSING
 * Internal uses: ACTIVE / INACTIVE / PENDING
 */
function mapPaymentMethodStatus(antomStatus: string): string {
  switch (antomStatus) {
    case 'SUCCESS':
      return 'ACTIVE';
    case 'FAIL':
      return 'INACTIVE';
    case 'PROCESSING':
      return 'PENDING';
    default:
      return antomStatus;
  }
}

async function handlePaymentMethodActivation(
  merchantId: string,
  notification: AntomNotification
) {
  // Extract payment method info from:
  // 1. paymentMethodStatusChangeEvent (actual Antom callback format)
  // 2. paymentMethodDetail (alternative Antom format)
  // 3. flat fields (legacy/mock)
  const pmEvent = notification.paymentMethodStatusChangeEvent;
  const pmType =
    pmEvent?.paymentMethodType ||
    notification.paymentMethodDetail?.paymentMethodType ||
    notification.paymentMethodType;

  // For status, paymentMethodStatusChangeEvent uses `currentStatus` which needs mapping
  const rawStatus =
    pmEvent?.currentStatus ||
    notification.paymentMethodDetail?.paymentMethodStatus ||
    notification.paymentMethodStatus;

  if (!pmType || !rawStatus) {
    console.warn(`[Notify] PAYMENT_METHOD_ACTIVATION_STATUS missing paymentMethodType or status for merchant ${merchantId}`);
    return;
  }

  // Map Antom status (SUCCESS/FAIL/PROCESSING) to internal status (ACTIVE/INACTIVE/PENDING)
  const pmStatus = mapPaymentMethodStatus(rawStatus);

  // Save Antom-assigned merchant ID if not yet recorded
  // paymentMethodStatusChangeEvent.merchantAccountId is the same as parentMerchantId in registration result
  const antomMerchantId = pmEvent?.merchantAccountId;
  if (antomMerchantId) {
    const currentMerchantForId = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (currentMerchantForId && !currentMerchantForId.antomMerchantId) {
      await prisma.merchant.update({
        where: { id: merchantId },
        data: { antomMerchantId },
      });
    }
  }

  const pm = await prisma.paymentMethod.findFirst({
    where: { merchantId, paymentMethodType: pmType },
  });

  if (pm) {
    await prisma.paymentMethod.update({
      where: { id: pm.id },
      data: {
        status: pmStatus,
        activatedAt: pmStatus === 'ACTIVE' ? new Date() : undefined,
      },
    });
  }

  // Re-evaluate merchant status: merchant becomes ACTIVE only when
  // kycStatus=APPROVED AND at least one payment method is ACTIVE
  const merchantStatus = await evaluateMerchantActiveStatus(merchantId);
  const currentMerchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (currentMerchant && currentMerchant.status !== 'OFFBOARDED' && currentMerchant.status !== merchantStatus) {
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { status: merchantStatus },
    });
    console.log(`[Notify] Merchant ${merchantId} status updated to ${merchantStatus} after payment method ${pmType} changed to ${pmStatus}`);
  }

  if (pmEvent?.failReason) {
    console.log(`[Notify] Payment method ${pmType} for merchant ${merchantId}: ${rawStatus} -> ${pmStatus} (reason: ${pmEvent.failReason})`);
  } else {
    console.log(`[Notify] Payment method ${pmType} for merchant ${merchantId}: ${rawStatus} -> ${pmStatus}`);
  }
}

async function handleRiskNotification(
  merchantId: string,
  notification: AntomNotification
) {
  // Support both nested riskScoreResult (actual Antom format: MERCHANT_RISK_SCORE_NOTIFICATION)
  // and flat fields (legacy RISK_NOTIFICATION / mock)
  const riskResult = notification.riskScoreResult;
  const riskLevel = riskResult?.riskLevel || notification.riskLevel;
  const riskReasonCodes = riskResult?.reasonCodes || notification.riskReasonCodes;

  await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      riskLevel: riskLevel,
      riskReasonCodes: riskReasonCodes
        ? JSON.stringify(riskReasonCodes)
        : undefined,
    },
  });

  console.log(`[Notify] Risk notification for merchant ${merchantId}: riskLevel=${riskLevel}, reasonCodes=${JSON.stringify(riskReasonCodes)}`);
}
