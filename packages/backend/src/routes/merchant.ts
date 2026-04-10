import { Router, Request, Response } from 'express';
import { merchantService } from '../services/merchantService';
import { antomService } from '../services/antomService';
import { mockService } from '../services/mockService';
import { config } from '../utils/config';

const router = Router();

function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

// POST /api/merchants - Create merchant
router.post('/', async (req: Request, res: Response) => {
  try {
    const { shopName, region, email } = req.body;
    if (!shopName || !email) {
      res.status(400).json({ error: 'shopName and email are required' });
      return;
    }
    const merchant = await merchantService.create({ shopName, region, email });
    res.status(201).json(merchant);
  } catch (err) {
    console.error('[Merchant] Create error:', err);
    res.status(500).json({ error: 'Failed to create merchant' });
  }
});

// GET /api/merchants - List merchants
router.get('/', async (_req: Request, res: Response) => {
  try {
    const merchants = await merchantService.list();
    res.json({ data: merchants });
  } catch (err) {
    console.error('[Merchant] List error:', err);
    res.status(500).json({ error: 'Failed to list merchants' });
  }
});

// GET /api/merchants/stats - Dashboard stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const merchantId = req.query.merchantId ? paramStr(req.query.merchantId as string) : undefined;
    const stats = await merchantService.getStats(merchantId);
    const recentNotifications = await merchantService.getRecentNotifications(10, merchantId);
    res.json({ ...stats, recentNotifications });
  } catch (err) {
    console.error('[Merchant] Stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/merchants/:id - Get merchant detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const merchant = await merchantService.getById(id);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }
    // Parse JSON fields for the response
    const result = {
      ...merchant,
      riskReasonCodes: merchant.riskReasonCodes ? JSON.parse(merchant.riskReasonCodes as string) : null,
      kycInfo: merchant.kycInfo
        ? {
            ...merchant.kycInfo,
            wfKycData: merchant.kycInfo.wfKycData
              ? JSON.parse(merchant.kycInfo.wfKycData as string)
              : null,
            rejectedFields: merchant.kycInfo.rejectedFields
              ? JSON.parse(merchant.kycInfo.rejectedFields as string)
              : null,
          }
        : null,
    };
    res.json(result);
  } catch (err) {
    console.error('[Merchant] Get error:', err);
    res.status(500).json({ error: 'Failed to get merchant' });
  }
});

// POST /api/merchants/:id/wf-account - Update WF account ID
router.post('/:id/wf-account', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const { wfAccountId } = req.body;
    if (!wfAccountId) {
      res.status(400).json({ error: 'wfAccountId is required' });
      return;
    }
    await merchantService.updateWfAccount(id, wfAccountId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Merchant] WF account error:', err);
    res.status(500).json({ error: 'Failed to update WF account' });
  }
});

// POST /api/merchants/:id/kyc - Submit/update KYC
router.post('/:id/kyc', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const {
      legalName, companyType, certificateType, certificateNo,
      branchName, companyUnit,
      addressRegion, addressState, addressCity, address1, address2, zipCode,
      mcc, doingBusinessAs, websiteUrl, englishName, serviceDescription,
      appName, merchantBrandName,
      contactType, contactInfo,
      legalRepName, legalRepIdType, legalRepIdNo, legalRepDob,
      wfKycData,
    } = req.body;
    await merchantService.upsertKyc(id, {
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
  } catch (err) {
    console.error('[Merchant] KYC error:', err);
    res.status(500).json({ error: 'Failed to update KYC' });
  }
});

// POST /api/merchants/:id/entity-associations - Upsert entity associations (directors/UBOs)
router.post('/:id/entity-associations', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const { associations } = req.body;
    if (!Array.isArray(associations)) {
      res.status(400).json({ error: 'associations array is required' });
      return;
    }
    await merchantService.upsertEntityAssociations(id, associations);
    res.json({ success: true });
  } catch (err) {
    console.error('[Merchant] Entity associations error:', err);
    res.status(500).json({ error: 'Failed to update entity associations' });
  }
});

// POST /api/merchants/:id/register - Trigger Antom registration (guide section 4.1)
router.post('/:id/register', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const { paymentMethodTypes } = req.body;
    if (!paymentMethodTypes || !Array.isArray(paymentMethodTypes) || paymentMethodTypes.length === 0) {
      res.status(400).json({ error: 'paymentMethodTypes array is required' });
      return;
    }

    const merchant = await merchantService.getById(id);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    // Create local registration
    const { registrationRequestId } = await merchantService.register(id, paymentMethodTypes);

    // Call Antom API with nested merchant object (or mock)
    const registerRequest = {
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
    };
    console.log('[Merchant] antomService.register >>> request:', JSON.stringify(registerRequest, null, 2));
    const antomResponse = await antomService.register(registerRequest);
    console.log('[Merchant] antomService.register <<< response:', JSON.stringify(antomResponse, null, 2));

    // Return response (use resultInfo if available, fallback to result)
    const resultInfo = antomResponse.resultInfo || antomResponse.result;
    const resultStatus = resultInfo?.resultStatus;

    if (resultStatus === 'F') {
      res.status(400).json({
        registrationRequestId,
        resultInfo,
        error: resultInfo?.resultMessage || 'Registration failed at Antom',
      });
      return;
    }

    // In mock mode, schedule auto notifications
    if (config.mockMode) {
      mockService.scheduleRegisterNotifications(
        registrationRequestId,
        paymentMethodTypes,
        merchant.referenceMerchantId || merchant.id
      );
    }

    res.json({ registrationRequestId, resultInfo });
  } catch (err) {
    console.error('[Merchant] Register error:', err);
    res.status(500).json({ error: 'Failed to register merchant' });
  }
});

// POST /api/merchants/:id/setup-payments - Combined WF auth + KYB query + KYC fill + register
// This endpoint handles the full flow: query KYB from Antom using WF auth, save KYC, and register
router.post('/:id/setup-payments', async (req: Request, res: Response) => {
  let currentStep: 'queryKyb' | 'fillKyc' | 'register' = 'queryKyb';
  try {
    const id = paramStr(req.params.id);
    const { wfAccountId, accessToken, customerId, kycOverrides } = req.body;

    if (!accessToken) {
      res.status(400).json({ success: false, error: 'accessToken is required' });
      return;
    }

    const merchant = await merchantService.getById(id);
    if (!merchant) {
      res.status(404).json({ success: false, error: 'Merchant not found' });
      return;
    }

    // Step 1: Save WF account ID
    await merchantService.updateWfAccount(id, wfAccountId);

    // Step 2: Query KYB info from Antom using WF access token
    console.log('[Merchant] antomService.queryKybInfo >>> request: accessToken=%s, customerId=%s', accessToken, customerId || '');
    const kybResult = await antomService.queryKybInfo(accessToken, customerId || '');
    console.log('[Merchant] antomService.queryKybInfo <<< response: success=%s, error=%s', kybResult.success, kybResult.error || 'none');
    if (!kybResult.success || !kybResult.kybData) {
      res.status(400).json({ success: false, failedStep: 'queryKyb', error: kybResult.error || 'Failed to query KYB information' });
      return;
    }

    const kybData = kybResult.kybData;
    currentStep = 'fillKyc';

    // Step 3: Fill KYC info from KYB data + extra fields (Shopify auto-fills, merchant doesn't need to input)
    // kycOverrides from frontend takes priority over KYB data for user-editable fields
    const overrides = kycOverrides || {};
    const kycPayload = {
      // All fields: prefer frontend overrides (user-edited values) over KYB raw data
      legalName: overrides.legalName || String(kybData.legalName || merchant.shopName),
      companyType: overrides.companyType || String(kybData.companyType || ''),
      certificateType: overrides.certificateType || String(kybData.certificateType || ''),
      certificateNo: overrides.certificateNo || String(kybData.certificateNo || ''),
      branchName: overrides.branchName ?? String(kybData.branchName || ''),
      companyUnit: overrides.companyUnit ?? String(kybData.companyUnit || ''),
      addressRegion: overrides.addressRegion || String(kybData.addressRegion || ''),
      addressState: overrides.addressState || String(kybData.addressState || ''),
      addressCity: overrides.addressCity || String(kybData.addressCity || ''),
      address1: overrides.address1 || String(kybData.address1 || ''),
      address2: overrides.address2 ?? String(kybData.address2 || ''),
      zipCode: overrides.zipCode ?? String(kybData.zipCode || ''),
      mcc: overrides.mcc || String(kybData.mcc || ''),
      doingBusinessAs: overrides.doingBusinessAs || String(kybData.doingBusinessAs || ''),
      websiteUrl: overrides.websiteUrl || String(kybData.websiteUrl || ''),
      englishName: overrides.englishName ?? String(kybData.englishName || ''),
      serviceDescription: overrides.serviceDescription ?? String(kybData.serviceDescription || ''),
      appName: overrides.appName || merchant.shopName,
      merchantBrandName: overrides.merchantBrandName ?? String(kybData.merchantBrandName || merchant.shopName),
      contactType: overrides.contactType ?? String(kybData.contactType || ''),
      contactInfo: overrides.contactInfo || String(kybData.contactInfo || merchant.email),
      legalRepName: overrides.legalRepName ?? String(kybData.legalRepName || ''),
      legalRepIdType: overrides.legalRepIdType ?? String(kybData.legalRepIdType || ''),
      legalRepIdNo: overrides.legalRepIdNo ?? String(kybData.legalRepIdNo || ''),
      legalRepDob: overrides.legalRepDob ?? String(kybData.legalRepDob || ''),
      wfKycData: kybData,
    };

    await merchantService.upsertKyc(id, kycPayload);

    // Step 3b: Save entity associations from KYB data
    if (Array.isArray(kybData.entityAssociations) && kybData.entityAssociations.length > 0) {
      const associations = (kybData.entityAssociations as Record<string, unknown>[]).map((ea) => ({
        associationType: String(ea.associationType || 'DIRECTOR'),
        shareholdingRatio: String(ea.shareholdingRatio || ''),
        fullName: String(ea.fullName || ''),
        firstName: String(ea.firstName || ''),
        lastName: String(ea.lastName || ''),
        dateOfBirth: String(ea.dateOfBirth || ''),
        idType: String(ea.idType || ''),
        idNo: String(ea.idNo || ''),
      }));
      await merchantService.upsertEntityAssociations(id, associations);
    }

    // Step 4: Register with all payment methods
    currentStep = 'register';
    const paymentMethodTypes = ['VISA', 'MASTERCARD', 'ALIPAY_HK',  'PAYNOW'];
    const { registrationRequestId } = await merchantService.register(id, paymentMethodTypes);

    // Reload merchant to get fresh data
    const updatedMerchant = await merchantService.getById(id);

    let antomResponse;
    try {
      const registerRequest = {
        registrationRequestId,
        merchant: {
          email: merchant.email,
          referenceMerchantId: merchant.referenceMerchantId || merchant.id,
          wfAccountId,
          settlementCurrency: merchant.settlementCurrency,
        },
        kycInfo: updatedMerchant?.kycInfo || null,
        entityAssociations: updatedMerchant?.entityAssociations || [],
        paymentMethodTypes,
      };
      console.log('[Merchant] antomService.register (setup-payments) >>> request:', JSON.stringify(registerRequest, null, 2));
      antomResponse = await antomService.register(registerRequest);
      console.log('[Merchant] antomService.register (setup-payments) <<< response:', JSON.stringify(antomResponse, null, 2));
    } catch (registerErr) {
      console.error('[Merchant] Antom register call failed:', registerErr);
      res.status(500).json({
        success: false,
        failedStep: 'register',
        registrationRequestId,
        error: registerErr instanceof Error ? registerErr.message : 'Failed to call Antom register API',
      });
      return;
    }

    // Check if Antom API returned a failure
    const resultInfo = antomResponse.resultInfo || antomResponse.result;
    const resultStatus = resultInfo?.resultStatus;

    if (resultStatus === 'F') {
      res.status(400).json({
        success: false,
        failedStep: 'register',
        registrationRequestId,
        resultInfo,
        error: resultInfo?.resultMessage || 'Registration failed at Antom',
      });
      return;
    }

    // In mock mode, schedule auto notifications
    if (config.mockMode) {
      mockService.scheduleRegisterNotifications(
        registrationRequestId,
        paymentMethodTypes,
        merchant.referenceMerchantId || merchant.id
      );
    }

    res.json({ success: true, registrationRequestId, resultInfo });
  } catch (err) {
    console.error('[Merchant] Setup payments error:', err);
    res.status(500).json({ success: false, failedStep: currentStep, error: 'Failed to setup payments' });
  }
});

// GET /api/merchants/:id/registration-status - Query registration status (guide section 4.2)
// Called when user opens merchant detail page; updates local status based on Antom response
router.get('/:id/registration-status', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const merchant = await merchantService.getById(id);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    if (!merchant.registrationRequestId) {
      res.status(400).json({ error: 'Merchant has not been registered yet' });
      return;
    }

    const inquireRequest = {
      registrationRequestId: merchant.registrationRequestId,
      referenceMerchantId: merchant.referenceMerchantId || merchant.id,
    };
    console.log('[Merchant] antomService.inquireRegistrationStatus >>> request:', JSON.stringify(inquireRequest, null, 2));
    const antomResponse = await antomService.inquireRegistrationStatus(inquireRequest);
    console.log('[Merchant] antomService.inquireRegistrationStatus <<< response:', JSON.stringify(antomResponse, null, 2));

    // Update local merchant status based on Antom registration result
    const registrationResult = antomResponse.registrationResult;
    if (registrationResult?.registrationStatus) {
      await merchantService.updateStatusFromRegistrationResult(id, registrationResult.registrationStatus);
    }

    // Return Antom response along with refreshed merchant data
    const updatedMerchant = await merchantService.getById(id);
    res.json({ ...antomResponse, merchant: updatedMerchant });
  } catch (err) {
    console.error('[Merchant] Registration status error:', err);
    res.status(500).json({ error: 'Failed to query registration status' });
  }
});

// POST /api/merchants/:id/offboard - Close shop (guide section 4.4)
router.post('/:id/offboard', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const merchant = await merchantService.getById(id);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }
    if (merchant.status === 'OFFBOARDED') {
      res.status(400).json({ error: 'Merchant is already offboarded' });
      return;
    }

    // Generate offboardingRequestId and store it
    const { offboardingRequestId } = await merchantService.offboard(id);

    // Call Antom API with separate offboardingRequestId
    const offboardRequest = {
      offboardingRequestId,
      referenceMerchantId: merchant.referenceMerchantId || merchant.id,
    };
    console.log('[Merchant] antomService.offboard >>> request:', JSON.stringify(offboardRequest, null, 2));
    const antomResponse = await antomService.offboard(offboardRequest);
    console.log('[Merchant] antomService.offboard <<< response:', JSON.stringify(antomResponse, null, 2));

    // In mock mode, schedule offboard notification
    if (config.mockMode) {
      mockService.scheduleOffboardNotification(
        offboardingRequestId,
        merchant.referenceMerchantId || merchant.id
      );
    }

    const resultInfo = antomResponse.resultInfo || antomResponse.result;
    res.json({ success: true, offboardingRequestId, resultInfo });
  } catch (err) {
    console.error('[Merchant] Offboard error:', err);
    res.status(500).json({ error: 'Failed to offboard merchant' });
  }
});

// GET /api/merchants/:id/payment-methods - List payment methods
router.get('/:id/payment-methods', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const data = await merchantService.getPaymentMethods(id);
    res.json({ data });
  } catch (err) {
    console.error('[Merchant] Payment methods error:', err);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
});

// POST /api/merchants/:id/payment-methods/:pmId/deactivate - Deactivate PM
router.post('/:id/payment-methods/:pmId/deactivate', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const pmId = paramStr(req.params.pmId);
    const merchant = await merchantService.getById(id);
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
      console.log('[Merchant] antomService.deactivate >>> request: registrationRequestId=%s, paymentMethodType=%s', merchant.registrationRequestId, pm.paymentMethodType);
      const deactivateResponse = await antomService.deactivate(merchant.registrationRequestId, pm.paymentMethodType);
      console.log('[Merchant] antomService.deactivate <<< response:', JSON.stringify(deactivateResponse, null, 2));
    }

    await merchantService.deactivatePaymentMethod(pmId);
    res.json({ success: true, paymentMethodStatus: 'INACTIVE' });
  } catch (err) {
    console.error('[Merchant] Deactivate PM error:', err);
    res.status(500).json({ error: 'Failed to deactivate payment method' });
  }
});

// GET /api/merchants/:id/notifications - List notifications
router.get('/:id/notifications', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const data = await merchantService.getNotifications(id);
    // Parse JSON payloads
    const parsed = data.map((n) => ({
      ...n,
      payload: typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload,
    }));
    res.json({ data: parsed });
  } catch (err) {
    console.error('[Merchant] Notifications error:', err);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

export default router;
