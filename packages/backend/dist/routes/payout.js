"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const merchantService_1 = require("../services/merchantService");
const antomService_1 = require("../services/antomService");
const router = (0, express_1.Router)();
function paramStr(val) {
    return Array.isArray(val) ? val[0] : val;
}
// GET /api/payouts/accounts/:merchantId - Query payout accounts
router.get('/accounts/:merchantId', async (req, res) => {
    try {
        const merchantId = paramStr(req.params.merchantId);
        const merchant = await merchantService_1.merchantService.getById(merchantId);
        if (!merchant) {
            res.status(404).json({ error: 'Merchant not found' });
            return;
        }
        const referenceMerchantId = merchant.referenceMerchantId || merchant.id;
        const settlementCurrencyList = [merchant.settlementCurrency];
        console.log('[Payout] queryPayoutAccounts >>> referenceMerchantId=%s, currencies=%s', referenceMerchantId, settlementCurrencyList.join(','));
        const result = await antomService_1.antomService.queryPayoutAccounts(referenceMerchantId, settlementCurrencyList);
        console.log('[Payout] queryPayoutAccounts <<< response:', JSON.stringify(result, null, 2));
        res.json(result);
    }
    catch (err) {
        console.error('[Payout] queryPayoutAccounts error:', err);
        res.status(500).json({ error: 'Failed to query payout accounts' });
    }
});
// GET /api/payouts/settings/:merchantId - Query payout settings
router.get('/settings/:merchantId', async (req, res) => {
    try {
        const merchantId = paramStr(req.params.merchantId);
        const currency = req.query.currency;
        if (!currency) {
            res.status(400).json({ error: 'currency query parameter is required' });
            return;
        }
        const merchant = await merchantService_1.merchantService.getById(merchantId);
        if (!merchant) {
            res.status(404).json({ error: 'Merchant not found' });
            return;
        }
        const referenceMerchantId = merchant.referenceMerchantId || merchant.id;
        console.log('[Payout] queryPayoutSettings >>> referenceMerchantId=%s, currency=%s', referenceMerchantId, currency);
        const result = await antomService_1.antomService.queryPayoutSettings(referenceMerchantId, currency);
        console.log('[Payout] queryPayoutSettings <<< response:', JSON.stringify(result, null, 2));
        res.json(result);
    }
    catch (err) {
        console.error('[Payout] queryPayoutSettings error:', err);
        res.status(500).json({ error: 'Failed to query payout settings' });
    }
});
// PUT /api/payouts/settings/:merchantId - Update payout settings
router.put('/settings/:merchantId', async (req, res) => {
    try {
        const merchantId = paramStr(req.params.merchantId);
        const { requestId, settlementCurrency, payoutActionType, settlementSetting } = req.body;
        if (!requestId || !settlementCurrency || !payoutActionType) {
            res.status(400).json({ error: 'requestId, settlementCurrency, and payoutActionType are required' });
            return;
        }
        const merchant = await merchantService_1.merchantService.getById(merchantId);
        if (!merchant) {
            res.status(404).json({ error: 'Merchant not found' });
            return;
        }
        const referenceMerchantId = merchant.referenceMerchantId || merchant.id;
        const updateData = {
            requestId,
            referenceMerchantId,
            settlementCurrency,
            payoutActionType,
            settlementSetting,
        };
        console.log('[Payout] updatePayoutSettings >>> request:', JSON.stringify(updateData, null, 2));
        const result = await antomService_1.antomService.updatePayoutSettings(updateData);
        console.log('[Payout] updatePayoutSettings <<< response:', JSON.stringify(result, null, 2));
        res.json(result);
    }
    catch (err) {
        console.error('[Payout] updatePayoutSettings error:', err);
        res.status(500).json({ error: 'Failed to update payout settings' });
    }
});
exports.default = router;
//# sourceMappingURL=payout.js.map