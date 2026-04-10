"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const signatureVerify_1 = require("../middleware/signatureVerify");
const notifyService_1 = require("../services/notifyService");
const router = (0, express_1.Router)();
// POST /register/notification - Receive Antom async notification (guide section 4.3)
router.post('/notification', signatureVerify_1.signatureVerify, async (req, res) => {
    try {
        const notification = req.body;
        console.log('[Notify] Antom callback <<< received notification:', JSON.stringify(notification, null, 2));
        // Validate required fields: notifyId + (notificationType or notifyType)
        const notificationType = notification.notificationType || notification.notifyType;
        if (!notification.notifyId || !notificationType) {
            // Per guide: still return success format even on error
            const errorResponse = {
                result: { resultCode: 'INVALID_PARAM', resultValue: 'F', message: 'Missing required fields' },
            };
            console.log('[Notify] Antom callback >>> response (invalid):', JSON.stringify(errorResponse, null, 2));
            res.status(400).json(errorResponse);
            return;
        }
        await notifyService_1.notifyService.processNotification(notification);
        // Return fixed response per guide section 4.3
        const successResponse = {
            result: { resultCode: 'SUCCESS', resultValue: 'S', message: 'success' },
        };
        console.log('[Notify] Antom callback >>> response:', JSON.stringify(successResponse, null, 2));
        res.json(successResponse);
    }
    catch (err) {
        console.error('[Notify] Error processing notification:', err);
        res.status(500).json({
            result: { resultCode: 'ERROR', resultValue: 'F', message: 'Internal error' },
        });
    }
});
exports.default = router;
//# sourceMappingURL=notify.js.map