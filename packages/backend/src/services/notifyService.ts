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
 * Extract registrationRequestId from either flat field or nested merchantRegistrationResult.
 */
function getRegistrationRequestId(notification: AntomNotification): string | undefined {
  return (
    notification.registrationRequestId ||
    notification.merchantRegistrationResult?.registrationRequestId ||
    notification.merchantOffboardingResult?.offboardingRequestId
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
    // Idempotency check
    const existing = await prisma.notification.findUnique({
      where: { notifyId: notification.notifyId },
    });
    if (existing) {
      console.log(`[Notify] Duplicate notifyId: ${notification.notifyId}, skipping`);
      return false;
    }

    const notificationType = getNotificationType(notification);
    const registrationRequestId = getRegistrationRequestId(notification);

    if (!registrationRequestId) {
      console.error('[Notify] No registrationRequestId found in notification');
      return false;
    }

    // Find merchant by registrationRequestId (or offboardingRequestId)
    let merchant = await prisma.merchant.findFirst({
      where: { registrationRequestId },
    });

    // Also try offboardingRequestId for offboard notifications
    if (!merchant && notification.merchantOffboardingResult) {
      merchant = await prisma.merchant.findFirst({
        where: { offboardingRequestId: notification.merchantOffboardingResult.offboardingRequestId },
      });
    }

    if (!merchant) {
      console.error(`[Notify] Merchant not found for requestId: ${registrationRequestId}`);
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
        await handleRiskNotification(merchant.id, notification);
        break;
    }

    // Save notification record
    await prisma.notification.create({
      data: {
        merchantId: merchant.id,
        notifyId: notification.notifyId,
        notificationType: notificationType,
        payload: JSON.stringify(notification),
      },
    });

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

  if (kycStatus === 'APPROVED') {
    updateData.status = 'ACTIVE';
  } else if (kycStatus === 'REJECTED' || kycStatus === 'SUPPLEMENT_REQUIRED') {
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

  await prisma.merchant.update({
    where: { id: merchantId },
    data: updateData,
  });

  console.log(`[Notify] Registration status for merchant ${merchantId}: ${antomStatus} -> kycStatus=${kycStatus}`);
}

async function handlePaymentMethodActivation(
  merchantId: string,
  notification: AntomNotification
) {
  const pmType = notification.paymentMethodType;
  const pmStatus = notification.paymentMethodStatus;

  if (!pmType || !pmStatus) return;

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

  console.log(`[Notify] Payment method ${pmType} for merchant ${merchantId}: ${pmStatus}`);
}

async function handleRiskNotification(
  merchantId: string,
  notification: AntomNotification
) {
  await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      riskLevel: notification.riskLevel,
      riskReasonCodes: notification.riskReasonCodes
        ? JSON.stringify(notification.riskReasonCodes)
        : undefined,
    },
  });

  console.log(`[Notify] Risk notification for merchant ${merchantId}: ${notification.riskLevel}`);
}
