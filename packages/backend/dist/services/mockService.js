"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockService = void 0;
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const config_1 = require("../utils/config");
const notifyService_1 = require("./notifyService");
const prisma = new client_1.PrismaClient();
exports.mockService = {
    /**
     * Schedule mock notifications after a register call.
     * Uses pre-configured mock presets from config.
     * Generates notifications in guide-format (nested merchantRegistrationResult).
     */
    scheduleRegisterNotifications(registrationRequestId, paymentMethodTypes, referenceMerchantId) {
        const delay = config_1.config.mockNotifyDelayMs;
        const { parentMerchantId } = config_1.config.antom;
        const { kycResult, rejectedReason, rejectedFields, paymentMethodStatuses, riskEnabled, riskLevel, riskReasonCodes } = config_1.config.mockPresets;
        setTimeout(async () => {
            try {
                // 1. Registration status notification (guide format)
                // Map internal preset values to guide status values
                let registrationStatus;
                let failReasonType;
                let failReasonDescription;
                if (kycResult === 'APPROVED') {
                    registrationStatus = 'SUCCESS';
                }
                else if (kycResult === 'REJECTED') {
                    registrationStatus = 'FAIL';
                    failReasonType = 'REJECTED_DUE_TO_RISK';
                    failReasonDescription = rejectedReason || 'Rejecting for risk control reasons';
                }
                else {
                    // SUPPLEMENT_REQUIRED is a demo-only extension (not in guide)
                    registrationStatus = kycResult;
                }
                const kycNotification = {
                    notifyId: `mock_reg_${(0, uuid_1.v4)()}`,
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
                await notifyService_1.notifyService.processNotification(kycNotification);
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
                            await notifyService_1.notifyService.processNotification({
                                notifyId: `mock_pm_${(0, uuid_1.v4)()}`,
                                notificationType: 'PAYMENT_METHOD_ACTIVATION_STATUS',
                                registrationRequestId,
                                paymentMethodType: paymentMethodTypes[i],
                                paymentMethodStatus: pmStatus,
                            });
                        }
                        catch (err) {
                            console.error('[Mock] PM activation notification error:', err);
                        }
                    }, 200 * (i + 1));
                }
                // 3. Risk notification (only if enabled in presets)
                if (riskEnabled) {
                    setTimeout(async () => {
                        try {
                            await notifyService_1.notifyService.processNotification({
                                notifyId: `mock_risk_${(0, uuid_1.v4)()}`,
                                notificationType: 'RISK_NOTIFICATION',
                                registrationRequestId,
                                riskLevel,
                                riskReasonCodes: riskReasonCodes.length > 0 ? riskReasonCodes : [],
                            });
                        }
                        catch (err) {
                            console.error('[Mock] Risk notification error:', err);
                        }
                    }, 200 * (paymentMethodTypes.length + 1));
                }
            }
            catch (err) {
                console.error('[Mock] Registration notification error:', err);
            }
        }, delay);
    },
    /**
     * Schedule mock offboard notification.
     */
    scheduleOffboardNotification(offboardingRequestId, referenceMerchantId) {
        const delay = config_1.config.mockNotifyDelayMs;
        const { parentMerchantId } = config_1.config.antom;
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
                await notifyService_1.notifyService.processNotification({
                    notifyId: `mock_offboard_${(0, uuid_1.v4)()}`,
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
            }
            catch (err) {
                console.error('[Mock] Offboard notification error:', err);
            }
        }, delay);
    },
    /**
     * Manually trigger a mock notification (from Settings page).
     */
    async triggerNotification(merchantId, notificationType, data) {
        const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
        if (!merchant) {
            throw new Error(`Merchant ${merchantId} not found`);
        }
        if (!merchant.registrationRequestId) {
            throw new Error('Merchant has no registrationRequestId. Register first.');
        }
        const { parentMerchantId } = config_1.config.antom;
        const notifyId = `mock_manual_${(0, uuid_1.v4)()}`;
        let notification;
        switch (notificationType) {
            case 'REGISTRATION_STATUS': {
                const internalStatus = (data.registrationStatus || 'APPROVED');
                let registrationStatus;
                if (internalStatus === 'APPROVED')
                    registrationStatus = 'SUCCESS';
                else if (internalStatus === 'REJECTED')
                    registrationStatus = 'FAIL';
                else
                    registrationStatus = internalStatus;
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
                        rejectedFields: data.rejectedFields,
                        rejectedReason: data.rejectedReason,
                    } : {}),
                };
                break;
            }
            case 'PAYMENT_METHOD_ACTIVATION_STATUS':
                notification = {
                    notifyId,
                    notificationType: 'PAYMENT_METHOD_ACTIVATION_STATUS',
                    registrationRequestId: merchant.registrationRequestId,
                    paymentMethodType: data.paymentMethodType || 'Alipay',
                    paymentMethodStatus: data.paymentMethodStatus || 'ACTIVE',
                };
                break;
            case 'RISK_NOTIFICATION':
                notification = {
                    notifyId,
                    notificationType: 'RISK_NOTIFICATION',
                    registrationRequestId: merchant.registrationRequestId,
                    riskLevel: data.riskLevel || 'HIGH',
                    riskReasonCodes: data.riskReasonCodes || ['R001'],
                };
                break;
            default:
                throw new Error(`Unknown notification type: ${notificationType}`);
        }
        await notifyService_1.notifyService.processNotification(notification);
        return notifyId;
    },
};
//# sourceMappingURL=mockService.js.map