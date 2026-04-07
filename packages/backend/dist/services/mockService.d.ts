import type { NotificationType } from '../types';
export declare const mockService: {
    /**
     * Schedule mock notifications after a register call.
     * Uses pre-configured mock presets from config.
     * Generates notifications in guide-format (nested merchantRegistrationResult).
     */
    scheduleRegisterNotifications(registrationRequestId: string, paymentMethodTypes: string[], referenceMerchantId: string): void;
    /**
     * Schedule mock offboard notification.
     */
    scheduleOffboardNotification(offboardingRequestId: string, referenceMerchantId: string): void;
    /**
     * Manually trigger a mock notification (from Settings page).
     */
    triggerNotification(merchantId: string, notificationType: NotificationType, data: Record<string, unknown>): Promise<string>;
};
//# sourceMappingURL=mockService.d.ts.map