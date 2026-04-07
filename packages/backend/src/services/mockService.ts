import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../utils/config';
import { notifyService } from './notifyService';
import type { AntomNotification, NotificationType } from '../types';

const prisma = new PrismaClient();

export const mockService = {
  /**
   * Schedule mock notifications after a register call.
   * Uses pre-configured mock presets from config.
   * Generates notifications in guide-format (nested merchantRegistrationResult).
   */
  scheduleRegisterNotifications(
    registrationRequestId: string,
    paymentMethodTypes: string[],
    referenceMerchantId: string
  ) {
    const delay = config.mockNotifyDelayMs;
    const { parentMerchantId } = config.antom;
    const { kycResult, rejectedReason, rejectedFields, paymentMethodStatuses, riskEnabled, riskLevel, riskReasonCodes } = config.mockPresets;

    setTimeout(async () => {
      try {
        // 1. Registration status notification (guide format)
        // Map internal preset values to guide status values
        let registrationStatus: string;
        let failReasonType: string | undefined;
        let failReasonDescription: string | undefined;

        if (kycResult === 'APPROVED') {
          registrationStatus = 'SUCCESS';
        } else if (kycResult === 'REJECTED') {
          registrationStatus = 'FAIL';
          failReasonType = 'REJECTED_DUE_TO_RISK';
          failReasonDescription = rejectedReason || 'Rejecting for risk control reasons';
        } else {
          // SUPPLEMENT_REQUIRED is a demo-only extension (not in guide)
          registrationStatus = kycResult;
        }

        const kycNotification: AntomNotification = {
          notifyId: `mock_reg_${uuidv4()}`,
          notificationType: 'REGISTRATION_STATUS',
          registrationRequestId,
          merchantRegistrationResult: {
            registrationStatus,
            registrationRequestId,
            parentMerchantId,
            referenceMerchantId,
            ...(failReasonType ? { failReasonType, failReasonDescription } : {}),
          },
          // Legacy flat fields for SUPPLEMENT_REQUIRED demo extension
          ...(kycResult === 'SUPPLEMENT_REQUIRED' ? {
            registrationStatus: kycResult,
            rejectedFields: rejectedFields.length > 0 ? rejectedFields : ['certificateNo'],
            rejectedReason: rejectedReason || 'Please supplement the required information',
          } : {}),
        };

        await notifyService.processNotification(kycNotification);

        // Only proceed with payment method activations and risk if KYC is approved
        if (kycResult !== 'APPROVED') {
          console.log(`[Mock] KYC result is ${kycResult}, skipping payment method and risk notifications`);
          return;
        }

        // 2. Payment Method Activations (stagger by 200ms each)
        for (let i = 0; i < paymentMethodTypes.length; i++) {
          setTimeout(async () => {
            try {
              const pmStatus = paymentMethodStatuses[paymentMethodTypes[i]] || 'ACTIVE';
              await notifyService.processNotification({
                notifyId: `mock_pm_${uuidv4()}`,
                notificationType: 'PAYMENT_METHOD_ACTIVATION_STATUS',
                registrationRequestId,
                paymentMethodType: paymentMethodTypes[i],
                paymentMethodStatus: pmStatus,
              });
            } catch (err) {
              console.error('[Mock] PM activation notification error:', err);
            }
          }, 200 * (i + 1));
        }

        // 3. Risk notification (only if enabled in presets)
        if (riskEnabled) {
          setTimeout(async () => {
            try {
              await notifyService.processNotification({
                notifyId: `mock_risk_${uuidv4()}`,
                notificationType: 'RISK_NOTIFICATION',
                registrationRequestId,
                riskLevel,
                riskReasonCodes: riskReasonCodes.length > 0 ? riskReasonCodes : [],
              });
            } catch (err) {
              console.error('[Mock] Risk notification error:', err);
            }
          }, 200 * (paymentMethodTypes.length + 1));
        }
      } catch (err) {
        console.error('[Mock] Registration notification error:', err);
      }
    }, delay);
  },

  /**
   * Schedule mock offboard notification.
   */
  scheduleOffboardNotification(
    offboardingRequestId: string,
    referenceMerchantId: string
  ) {
    const delay = config.mockNotifyDelayMs;
    const { parentMerchantId } = config.antom;

    setTimeout(async () => {
      try {
        // Find merchant by offboardingRequestId to get registrationRequestId
        const merchant = await prisma.merchant.findFirst({
          where: { offboardingRequestId },
        });

        if (!merchant) {
          console.error(`[Mock] Merchant not found for offboardingRequestId: ${offboardingRequestId}`);
          return;
        }

        await notifyService.processNotification({
          notifyId: `mock_offboard_${uuidv4()}`,
          notificationType: 'REGISTRATION_STATUS',
          registrationRequestId: merchant.registrationRequestId || offboardingRequestId,
          merchantOffboardingResult: {
            offboardingStatus: 'SUCCESS',
            offboardingRequestId,
            parentMerchantId,
            referenceMerchantId,
          },
        });

        // Update merchant status to OFFBOARDED
        await prisma.merchant.update({
          where: { id: merchant.id },
          data: { status: 'OFFBOARDED' },
        });
      } catch (err) {
        console.error('[Mock] Offboard notification error:', err);
      }
    }, delay);
  },

  /**
   * Manually trigger a mock notification (from Settings page).
   */
  async triggerNotification(
    merchantId: string,
    notificationType: NotificationType,
    data: Record<string, unknown>
  ): Promise<string> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new Error(`Merchant ${merchantId} not found`);
    }
    if (!merchant.registrationRequestId) {
      throw new Error('Merchant has no registrationRequestId. Register first.');
    }

    const { parentMerchantId } = config.antom;
    const notifyId = `mock_manual_${uuidv4()}`;

    let notification: AntomNotification;

    switch (notificationType) {
      case 'REGISTRATION_STATUS': {
        const internalStatus = ((data.registrationStatus as string) || 'APPROVED');
        let registrationStatus: string;
        if (internalStatus === 'APPROVED') registrationStatus = 'SUCCESS';
        else if (internalStatus === 'REJECTED') registrationStatus = 'FAIL';
        else registrationStatus = internalStatus;

        notification = {
          notifyId,
          notificationType: 'REGISTRATION_STATUS',
          registrationRequestId: merchant.registrationRequestId,
          merchantRegistrationResult: {
            registrationStatus,
            registrationRequestId: merchant.registrationRequestId,
            parentMerchantId,
            referenceMerchantId: merchant.referenceMerchantId || merchant.id,
          },
          // Pass through legacy flat fields for SUPPLEMENT_REQUIRED
          ...(internalStatus === 'SUPPLEMENT_REQUIRED' ? {
            registrationStatus: internalStatus,
            rejectedFields: data.rejectedFields as string[] | undefined,
            rejectedReason: data.rejectedReason as string | undefined,
          } : {}),
        };
        break;
      }

      case 'PAYMENT_METHOD_ACTIVATION_STATUS':
        notification = {
          notifyId,
          notificationType: 'PAYMENT_METHOD_ACTIVATION_STATUS',
          registrationRequestId: merchant.registrationRequestId,
          paymentMethodType: (data.paymentMethodType as string) || 'Alipay',
          paymentMethodStatus: (data.paymentMethodStatus as string) || 'ACTIVE',
        };
        break;

      case 'RISK_NOTIFICATION':
        notification = {
          notifyId,
          notificationType: 'RISK_NOTIFICATION',
          registrationRequestId: merchant.registrationRequestId,
          riskLevel: (data.riskLevel as string) || 'HIGH',
          riskReasonCodes: (data.riskReasonCodes as string[]) || ['R001'],
        };
        break;

      default:
        throw new Error(`Unknown notification type: ${notificationType}`);
    }

    await notifyService.processNotification(notification);
    return notifyId;
  },
};
