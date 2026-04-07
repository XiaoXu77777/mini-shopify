"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mockService_1 = require("../services/mockService");
const router = (0, express_1.Router)();
// POST /api/mock/notify - Manually trigger a mock notification
router.post('/notify', async (req, res) => {
    try {
        const { merchantId, notificationType, data } = req.body;
        if (!merchantId || !notificationType) {
            res.status(400).json({ error: 'merchantId and notificationType are required' });
            return;
        }
        const validTypes = [
            'REGISTRATION_STATUS',
            'PAYMENT_METHOD_ACTIVATION_STATUS',
            'RISK_NOTIFICATION',
        ];
        if (!validTypes.includes(notificationType)) {
            res.status(400).json({ error: `notificationType must be one of: ${validTypes.join(', ')}` });
            return;
        }
        const notifyId = await mockService_1.mockService.triggerNotification(merchantId, notificationType, data || {});
        res.json({ success: true, notifyId });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Mock] Trigger error:', message);
        res.status(500).json({ error: message });
    }
});
exports.default = router;
//# sourceMappingURL=mock.js.map