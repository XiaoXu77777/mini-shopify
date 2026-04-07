import type { AntomNotification } from '../types';
export declare const notifyService: {
    /**
     * Process an incoming notification (from Antom or mock trigger).
     * Supports both guide-format (nested merchantRegistrationResult) and
     * legacy flat format for backward compatibility.
     * Returns true if processed, false if duplicate (idempotent).
     */
    processNotification(notification: AntomNotification): Promise<boolean>;
};
//# sourceMappingURL=notifyService.d.ts.map