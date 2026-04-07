"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const merchantService_1 = require("../services/merchantService");
const antomService_1 = require("../services/antomService");
const mockService_1 = require("../services/mockService");
const config_1 = require("../utils/config");
const router = (0, express_1.Router)();
function paramStr(val) {
    return Array.isArray(val) ? val[0] : val;
}
// POST /api/merchants - Create merchant
router.post('/', async (req, res) => {
    try {
        const { shopName, region, email } = req.body;
        if (!shopName || !email) {
            res.status(400).json({ error: 'shopName and email are required' });
            return;
        }
        const merchant = await merchantService_1.merchantService.create({ shopName, region, email });
        res.status(201).json(merchant);
    }
    catch (err) {
        console.error('[Merchant] Create error:', err);
        res.status(500).json({ error: 'Failed to create merchant' });
    }
});
// GET /api/merchants - List merchants
router.get('/', async (_req, res) => {
    try {
        const merchants = await merchantService_1.merchantService.list();
        res.json({ data: merchants });
    }
    catch (err) {
        console.error('[Merchant] List error:', err);
        res.status(500).json({ error: 'Failed to list merchants' });
    }
});
// GET /api/merchants/stats - Dashboard stats
router.get('/stats', async (_req, res) => {
    try {
        const stats = await merchantService_1.merchantService.getStats();
        const recentNotifications = await merchantService_1.merchantService.getRecentNotifications();
        res.json({ ...stats, recentNotifications });
    }
    catch (err) {
        console.error('[Merchant] Stats error:', err);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});
// GET /api/merchants/:id - Get merchant detail
router.get('/:id', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const merchant = await merchantService_1.merchantService.getById(id);
        if (!merchant) {
            res.status(404).json({ error: 'Merchant not found' });
            return;
        }
        // Parse JSON fields for the response
        const result = {
            ...merchant,
            riskReasonCodes: merchant.riskReasonCodes ? JSON.parse(merchant.riskReasonCodes) : null,
            kycInfo: merchant.kycInfo
                ? {
                    ...merchant.kycInfo,
                    wfKycData: merchant.kycInfo.wfKycData
                        ? JSON.parse(merchant.kycInfo.wfKycData)
                        : null,
                    rejectedFields: merchant.kycInfo.rejectedFields
                        ? JSON.parse(merchant.kycInfo.rejectedFields)
                        : null,
                }
                : null,
        };
        res.json(result);
    }
    catch (err) {
        console.error('[Merchant] Get error:', err);
        res.status(500).json({ error: 'Failed to get merchant' });
    }
});
// POST /api/merchants/:id/wf-account - Update WF account ID
router.post('/:id/wf-account', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const { wfAccountId } = req.body;
        if (!wfAccountId) {
            res.status(400).json({ error: 'wfAccountId is required' });
            return;
        }
        await merchantService_1.merchantService.updateWfAccount(id, wfAccountId);
        res.json({ success: true });
    }
    catch (err) {
        console.error('[Merchant] WF account error:', err);
        res.status(500).json({ error: 'Failed to update WF account' });
    }
});
// POST /api/merchants/:id/kyc - Submit/update KYC
router.post('/:id/kyc', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const { legalName, companyType, certificateType, certificateNo, branchName, companyUnit, addressRegion, addressState, addressCity, address1, address2, zipCode, mcc, doingBusinessAs, websiteUrl, englishName, serviceDescription, appName, merchantBrandName, contactType, contactInfo, legalRepName, legalRepIdType, legalRepIdNo, legalRepDob, wfKycData, } = req.body;
        await merchantService_1.merchantService.upsertKyc(id, {
            legalName, companyType, certificateType, certificateNo,
            branchName, companyUnit,
            addressRegion, addressState, addressCity, address1, address2, zipCode,
            mcc, doingBusinessAs, websiteUrl, englishName, serviceDescription,
            appName, merchantBrandName,
            contactType, contactInfo,
            legalRepName, legalRepIdType, legalRepIdNo, legalRepDob,
            wfKycData,
        });
        res.json({ success: true });
    }
    catch (err) {
        console.error('[Merchant] KYC error:', err);
        res.status(500).json({ error: 'Failed to update KYC' });
    }
});
// POST /api/merchants/:id/entity-associations - Upsert entity associations (directors/UBOs)
router.post('/:id/entity-associations', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const { associations } = req.body;
        if (!Array.isArray(associations)) {
            res.status(400).json({ error: 'associations array is required' });
            return;
        }
        await merchantService_1.merchantService.upsertEntityAssociations(id, associations);
        res.json({ success: true });
    }
    catch (err) {
        console.error('[Merchant] Entity associations error:', err);
        res.status(500).json({ error: 'Failed to update entity associations' });
    }
});
// POST /api/merchants/:id/register - Trigger Antom registration (guide section 4.1)
router.post('/:id/register', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const { paymentMethodTypes } = req.body;
        if (!paymentMethodTypes || !Array.isArray(paymentMethodTypes) || paymentMethodTypes.length === 0) {
            res.status(400).json({ error: 'paymentMethodTypes array is required' });
            return;
        }
        const merchant = await merchantService_1.merchantService.getById(id);
        if (!merchant) {
            res.status(404).json({ error: 'Merchant not found' });
            return;
        }
        // Create local registration
        const { registrationRequestId } = await merchantService_1.merchantService.register(id, paymentMethodTypes);
        // Call Antom API with nested merchant object (or mock)
        const antomResponse = await antomService_1.antomService.register({
            registrationRequestId,
            merchant: {
                email: merchant.email,
                referenceMerchantId: merchant.referenceMerchantId || merchant.id,
                wfAccountId: merchant.wfAccountId || undefined,
                settlementCurrency: merchant.settlementCurrency,
            },
            kycInfo: merchant.kycInfo,
            entityAssociations: merchant.entityAssociations,
            paymentMethodTypes,
        });
        // In mock mode, schedule auto notifications
        if (config_1.config.mockMode) {
            mockService_1.mockService.scheduleRegisterNotifications(registrationRequestId, paymentMethodTypes, merchant.referenceMerchantId || merchant.id);
        }
        // Return response (use resultInfo if available, fallback to result)
        const resultInfo = antomResponse.resultInfo || antomResponse.result;
        res.json({ registrationRequestId, resultInfo });
    }
    catch (err) {
        console.error('[Merchant] Register error:', err);
        res.status(500).json({ error: 'Failed to register merchant' });
    }
});
// GET /api/merchants/:id/registration-status - Query registration status (guide section 4.2)
router.get('/:id/registration-status', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const merchant = await merchantService_1.merchantService.getById(id);
        if (!merchant) {
            res.status(404).json({ error: 'Merchant not found' });
            return;
        }
        if (!merchant.registrationRequestId) {
            res.status(400).json({ error: 'Merchant has not been registered yet' });
            return;
        }
        const antomResponse = await antomService_1.antomService.inquireRegistrationStatus({
            registrationRequestId: merchant.registrationRequestId,
            referenceMerchantId: merchant.referenceMerchantId || merchant.id,
        });
        res.json(antomResponse);
    }
    catch (err) {
        console.error('[Merchant] Registration status error:', err);
        res.status(500).json({ error: 'Failed to query registration status' });
    }
});
// POST /api/merchants/:id/offboard - Close shop (guide section 4.4)
router.post('/:id/offboard', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const merchant = await merchantService_1.merchantService.getById(id);
        if (!merchant) {
            res.status(404).json({ error: 'Merchant not found' });
            return;
        }
        if (merchant.status === 'OFFBOARDED') {
            res.status(400).json({ error: 'Merchant is already offboarded' });
            return;
        }
        // Generate offboardingRequestId and store it
        const { offboardingRequestId } = await merchantService_1.merchantService.offboard(id);
        // Call Antom API with separate offboardingRequestId
        const antomResponse = await antomService_1.antomService.offboard({
            offboardingRequestId,
            referenceMerchantId: merchant.referenceMerchantId || merchant.id,
        });
        // In mock mode, schedule offboard notification
        if (config_1.config.mockMode) {
            mockService_1.mockService.scheduleOffboardNotification(offboardingRequestId, merchant.referenceMerchantId || merchant.id);
        }
        const resultInfo = antomResponse.resultInfo || antomResponse.result;
        res.json({ success: true, offboardingRequestId, resultInfo });
    }
    catch (err) {
        console.error('[Merchant] Offboard error:', err);
        res.status(500).json({ error: 'Failed to offboard merchant' });
    }
});
// GET /api/merchants/:id/payment-methods - List payment methods
router.get('/:id/payment-methods', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const data = await merchantService_1.merchantService.getPaymentMethods(id);
        res.json({ data });
    }
    catch (err) {
        console.error('[Merchant] Payment methods error:', err);
        res.status(500).json({ error: 'Failed to get payment methods' });
    }
});
// POST /api/merchants/:id/payment-methods/:pmId/deactivate - Deactivate PM
router.post('/:id/payment-methods/:pmId/deactivate', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const pmId = paramStr(req.params.pmId);
        const merchant = await merchantService_1.merchantService.getById(id);
        if (!merchant) {
            res.status(404).json({ error: 'Merchant not found' });
            return;
        }
        const pm = merchant.paymentMethods.find((p) => p.id === pmId);
        if (!pm) {
            res.status(404).json({ error: 'Payment method not found' });
            return;
        }
        // Call Antom API (or mock)
        if (merchant.registrationRequestId) {
            await antomService_1.antomService.deactivate(merchant.registrationRequestId, pm.paymentMethodType);
        }
        await merchantService_1.merchantService.deactivatePaymentMethod(pmId);
        res.json({ success: true, paymentMethodStatus: 'INACTIVE' });
    }
    catch (err) {
        console.error('[Merchant] Deactivate PM error:', err);
        res.status(500).json({ error: 'Failed to deactivate payment method' });
    }
});
// GET /api/merchants/:id/notifications - List notifications
router.get('/:id/notifications', async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        const data = await merchantService_1.merchantService.getNotifications(id);
        // Parse JSON payloads
        const parsed = data.map((n) => ({
            ...n,
            payload: typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload,
        }));
        res.json({ data: parsed });
    }
    catch (err) {
        console.error('[Merchant] Notifications error:', err);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});
exports.default = router;
//# sourceMappingURL=merchant.js.map