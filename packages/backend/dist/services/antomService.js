"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.antomService = void 0;
const config_1 = require("../utils/config");
const crypto_1 = require("../utils/crypto");
// API paths (production format, sandbox prefix will be added dynamically)
const REGISTER_PATH = '/ams/api/v1/merchant/register';
const INQUIRE_REGISTRATION_PATH = '/ams/api/v1/merchant/inquiryRegistrationStatus';
const OFFBOARD_PATH = '/ams/api/v1/merchant/offboard';
const DEACTIVATE_PATH = '/ams/api/v1/merchant/deactivate';
const QUERY_KYB_PATH = '/ams/v1/merchant/queryKybInfo';
const QUERY_PAYOUT_ACCOUNTS_PATH = '/ams/api/v1/payments/payouts/queryPayoutAccounts';
const QUERY_PAYOUT_SETTINGS_PATH = '/ams/api/v1/payments/payouts/queryPayoutSettings';
const UPDATE_PAYOUT_SETTINGS_PATH = '/ams/api/v1/payments/payouts/updatePayoutSettings';
/**
 * Get the actual API path, inserting /sandbox/ prefix for sandbox environment.
 * Production: /ams/api/v1/merchants/register
 * Sandbox:    /ams/sandbox/api/v1/merchants/register
 */
function getApiPath(path) {
    if (!config_1.config.antom.sandbox)
        return path;
    // Insert 'sandbox' after '/ams/'
    return path.replace('/ams/', '/ams/sandbox/');
}
async function callAntomApi(options) {
    const { path, body } = options;
    const requestBody = JSON.stringify(body);
    const requestTime = new Date().toISOString().replace('Z', '+00:00');
    const { clientId, privateKey, publicKey, baseUrl, agentToken } = config_1.config.antom;
    // Resolve actual URL path (with sandbox prefix if needed)
    // Note: sandbox prefix is only for URL routing, signature uses the original path
    const actualPath = getApiPath(path);
    // Generate signature (use original path without sandbox prefix)
    const signature = (0, crypto_1.signRequest)(path, clientId, requestTime, requestBody, privateKey);
    const signatureHeader = (0, crypto_1.buildSignatureHeader)(signature);
    // Build request
    const url = `${baseUrl}${actualPath}`;
    const headers = {
        'Content-Type': 'application/json; charset=UTF-8',
        'client-id': clientId,
        'Request-Time': requestTime,
        'Signature': signatureHeader,
    };
    if (agentToken) {
        headers['agent-token'] = agentToken;
    }
    // Print headers for debugging
    console.log(`[Antom] Request headers:`, JSON.stringify(headers, null, 2));
    // Send request
    console.log(`[Antom] >>> ${actualPath} | url=${url} | clientId=${clientId} | requestTime=${requestTime}`);
    console.log(`[Antom] >>> Request body: ${requestBody}`);
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: requestBody,
    });
    const responseBody = await response.text();
    console.log(`[Antom] <<< ${actualPath} | HTTP ${response.status} ${response.statusText}`);
    console.log(`[Antom] <<< Response body: ${responseBody.substring(0, 1000)}${responseBody.length > 1000 ? '...' : ''}`);
    try {
        return JSON.parse(responseBody);
    }
    catch (e) {
        console.error(`[Antom] !!! Failed to parse response JSON for ${actualPath}:`, e);
        console.error(`[Antom] !!! Raw response body: ${responseBody}`);
        throw new Error(`Antom API response is not valid JSON (HTTP ${response.status}): ${responseBody.substring(0, 200)}`);
    }
}
/**
 * Retry helper for Antom API calls.
 * Retries on resultStatus 'U' (Unknown/retryable) with exponential backoff.
 */
async function callWithRetry(options, maxRetries = 3, baseDelayMs = 1000) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const result = await callAntomApi(options);
        const status = result.resultInfo?.resultStatus || result.result?.resultStatus;
        if (status !== 'U' || attempt === maxRetries) {
            return result;
        }
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`[Antom] Result status U, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
    // Should never reach here, but TypeScript needs it
    throw new Error('Antom API retry exhausted');
}
/**
 * Build the nested Antom register request body from flat DB data.
 * Uses wfKycData (the full KYB response) for rich nested structures like
 * stores, entityAssociations (INDIVIDUAL/COMPANY), certificates with fileList, etc.
 */
function buildRegisterRequest(data) {
    const kyc = data.kycInfo;
    const { parentMerchantId } = config_1.config.antom;
    // Temporary workaround: KYB fileUrl cannot be used directly in register requests.
    // When useProxyFileUrl is enabled, replace all fileUrl/fileName with the configured proxy values.
    const resolveFileUrl = (originalUrl) => {
        if (config_1.config.useProxyFileUrl && originalUrl) {
            return config_1.config.proxyFileUrl;
        }
        return originalUrl;
    };
    const resolveFileName = (originalName) => {
        if (config_1.config.useProxyFileUrl && originalName) {
            return config_1.config.proxyFileName;
        }
        return originalName;
    };
    // Parse wfKycData if available (contains the full KYB response with nested structures)
    let wfKyc = null;
    if (kyc?.wfKycData) {
        try {
            wfKyc = typeof kyc.wfKycData === 'string' ? JSON.parse(kyc.wfKycData) : kyc.wfKycData;
        }
        catch {
            console.warn('[Antom] Failed to parse wfKycData, ignoring rich structures');
        }
    }
    // Build company object
    const company = {
        legalName: kyc?.legalName || undefined,
        companyType: kyc?.companyType || undefined,
        branchName: kyc?.branchName || undefined,
        companyUnit: kyc?.companyUnit || undefined,
        registeredAddress: {
            address1: kyc?.address1 || undefined,
            address2: kyc?.address2 || undefined,
            city: kyc?.addressCity || undefined,
            region: kyc?.addressRegion || undefined,
            state: kyc?.addressState || undefined,
            zipCode: kyc?.zipCode || undefined,
        },
    };
    // Add incorporationDate and vatNo from wfKycData
    if (wfKyc?.incorporationDate) {
        company.incorporationDate = String(wfKyc.incorporationDate);
    }
    if (wfKyc?.vatNo) {
        company.vatNo = String(wfKyc.vatNo);
    }
    // Add certificates with fileList from wfKycData if available, otherwise fallback to flat fields
    if (wfKyc?.certificates && Array.isArray(wfKyc.certificates)) {
        company.certificates = wfKyc.certificates.map((cert) => ({
            certificateNo: cert.certificateNo ? String(cert.certificateNo) : undefined,
            certificateType: cert.certificateType ? String(cert.certificateType) : undefined,
            fileList: Array.isArray(cert.fileList)
                ? cert.fileList.map((f) => ({
                    fileName: resolveFileName(String(f.fileName || '')),
                    fileUrl: resolveFileUrl(String(f.fileUrl || '')),
                }))
                : undefined,
            registrationCertificate: cert.registrationCertificate != null
                ? Boolean(cert.registrationCertificate)
                : undefined,
        }));
    }
    else if (kyc?.certificateNo || kyc?.certificateType) {
        company.certificates = [
            {
                certificateNo: kyc?.certificateNo || undefined,
                certificateType: kyc?.certificateType || undefined,
                registrationCertificate: true,
            },
        ];
    }
    // Add contact methods if present
    if (kyc?.contactInfo && kyc?.contactType) {
        company.contactMethods = [
            {
                contactMethodInfo: kyc.contactInfo,
                contactMethodType: kyc.contactType,
            },
        ];
    }
    // Build businessInfo object
    const businessInfo = {
        appName: kyc?.appName || data.merchant.email,
        doingBusinessAs: kyc?.doingBusinessAs || undefined,
        englishName: kyc?.englishName || undefined,
        mcc: kyc?.mcc || undefined,
        merchantBrandName: kyc?.merchantBrandName || undefined,
        serviceDescription: kyc?.serviceDescription || undefined,
    };
    if (kyc?.websiteUrl) {
        businessInfo.websites = [{ type: 'COMMON', url: kyc.websiteUrl }];
    }
    // Build entityAssociations from wfKycData (supports INDIVIDUAL and COMPANY types)
    let entityAssociations;
    if (wfKyc?.entityAssociations && Array.isArray(wfKyc.entityAssociations)) {
        entityAssociations = wfKyc.entityAssociations.map((ea) => {
            const legalEntityType = String(ea.legalEntityType || 'INDIVIDUAL');
            const assoc = {
                associationType: String(ea.associationType || ''),
                legalEntityType,
            };
            if (legalEntityType === 'INDIVIDUAL' && ea.individual) {
                const ind = ea.individual;
                assoc.individual = {
                    name: ind.name
                        ? {
                            firstName: ind.name.firstName
                                ? String(ind.name.firstName)
                                : undefined,
                            lastName: ind.name.lastName
                                ? String(ind.name.lastName)
                                : undefined,
                            fullName: ind.name.fullName
                                ? String(ind.name.fullName)
                                : undefined,
                        }
                        : { fullName: undefined },
                    nationality: ind.nationality ? String(ind.nationality) : undefined,
                    dateOfBirth: ind.dateOfBirth ? String(ind.dateOfBirth) : undefined,
                    certificates: Array.isArray(ind.certificates)
                        ? ind.certificates.map((cert) => ({
                            certificateNo: cert.certificateNo ? String(cert.certificateNo) : undefined,
                            certificateType: cert.certificateType ? String(cert.certificateType) : undefined,
                            fileList: Array.isArray(cert.fileList)
                                ? cert.fileList.map((f) => ({
                                    fileName: resolveFileName(String(f.fileName || '')),
                                    fileUrl: resolveFileUrl(String(f.fileUrl || '')),
                                }))
                                : undefined,
                            registrationCertificate: cert.registrationCertificate != null
                                ? Boolean(cert.registrationCertificate)
                                : undefined,
                        }))
                        : undefined,
                };
            }
            else if (legalEntityType === 'COMPANY' && ea.company) {
                const comp = ea.company;
                assoc.company = {
                    legalName: comp.legalName ? String(comp.legalName) : undefined,
                    companyType: comp.companyType ? String(comp.companyType) : undefined,
                    certificates: Array.isArray(comp.certificates)
                        ? comp.certificates.map((cert) => ({
                            certificateNo: cert.certificateNo ? String(cert.certificateNo) : undefined,
                            certificateType: cert.certificateType ? String(cert.certificateType) : undefined,
                            fileList: Array.isArray(cert.fileList)
                                ? cert.fileList.map((f) => ({
                                    fileName: resolveFileName(String(f.fileName || '')),
                                    fileUrl: resolveFileUrl(String(f.fileUrl || '')),
                                }))
                                : undefined,
                            registrationCertificate: cert.registrationCertificate != null
                                ? Boolean(cert.registrationCertificate)
                                : undefined,
                        }))
                        : undefined,
                };
            }
            return assoc;
        });
    }
    else if (data.entityAssociations && data.entityAssociations.length > 0) {
        // Fallback to flat DB entity associations (legacy path)
        entityAssociations = data.entityAssociations.map((ea) => ({
            associationType: ea.associationType,
            legalEntityType: 'INDIVIDUAL',
            shareholdingRatio: ea.shareholdingRatio ? parseFloat(ea.shareholdingRatio) : undefined,
            individual: {
                name: {
                    firstName: ea.firstName || undefined,
                    lastName: ea.lastName || undefined,
                    fullName: ea.fullName || undefined,
                },
                dateOfBirth: ea.dateOfBirth || undefined,
                certificates: ea.idNo
                    ? [{ certificateNo: ea.idNo, certificateType: ea.idType || undefined }]
                    : undefined,
            },
        }));
    }
    // Build stores from wfKycData
    let stores;
    if (wfKyc?.stores && Array.isArray(wfKyc.stores)) {
        stores = wfKyc.stores.map((store) => {
            const s = {
                name: store.name ? String(store.name) : undefined,
                referenceStoreId: store.referenceStoreId ? String(store.referenceStoreId) : undefined,
                region: store.region ? String(store.region) : undefined,
                mcc: store.mcc ? String(store.mcc) : undefined,
            };
            if (store.address && typeof store.address === 'object') {
                const addr = store.address;
                s.address = {
                    address1: addr.address1 ? String(addr.address1) : undefined,
                    address2: addr.address2 ? String(addr.address2) : undefined,
                    city: addr.city ? String(addr.city) : undefined,
                    region: addr.region ? String(addr.region) : undefined,
                    state: addr.state ? String(addr.state) : undefined,
                };
            }
            if (Array.isArray(store.attachments)) {
                s.attachments = store.attachments.map((att) => ({
                    attachmentType: String(att.attachmentType || ''),
                    fileList: Array.isArray(att.fileList)
                        ? att.fileList.map((f) => ({
                            fileName: resolveFileName(String(f.fileName || '')),
                            fileUrl: resolveFileUrl(String(f.fileUrl || '')),
                        }))
                        : [],
                }));
            }
            return s;
        });
    }
    // Build settlementInfoList (top-level, settlementAccountType is always WORLD_FIRST_ACCOUNT)
    const settlementInfoList = [
        {
            settlementAccountType: 'WORLD_FIRST_ACCOUNT',
            ...(data.merchant.wfAccountId
                ? { settlementAccountInfo: { accountNo: data.merchant.wfAccountId } }
                : {}),
            settlementCurrency: data.merchant.settlementCurrency,
        },
    ];
    // Build paymentMethodActivationRequests
    const paymentMethodActivationRequests = data.paymentMethodTypes.map((pmType) => ({
        paymentMethodType: pmType,
        productCodes: ['CASHIER_PAYMENT'],
    }));
    return {
        registrationRequestId: data.registrationRequestId,
        partnerId: parentMerchantId,
        merchant: {
            loginId: data.merchant.email,
            legalEntityType: 'COMPANY',
            integrationPartnerId: parentMerchantId,
            referenceMerchantId: data.merchant.referenceMerchantId,
            businessInfo,
            company,
            entityAssociations: entityAssociations && entityAssociations.length > 0 ? entityAssociations : undefined,
            stores: stores && stores.length > 0 ? stores : undefined,
        },
        settlementInfoList,
        paymentMethodActivationRequests,
    };
}
exports.antomService = {
    /**
     * Register a merchant with Antom (guide section 4.1).
     * Builds nested merchant object from flat DB data.
     */
    async register(data) {
        const requestBody = buildRegisterRequest(data);
        return callWithRetry({
            path: REGISTER_PATH,
            body: requestBody,
        });
    },
    /**
     * Query registration or offboarding status (guide section 4.2).
     */
    async inquireRegistrationStatus(data) {
        const { parentMerchantId } = config_1.config.antom;
        const requestBody = {
            merchant: {
                referenceMerchantId: data.referenceMerchantId,
                integrationPartnerId: parentMerchantId || undefined,
            },
        };
        if (data.registrationRequestId) {
            requestBody.registrationRequestId = data.registrationRequestId;
        }
        if (data.offboardingRequestId) {
            requestBody.offboardingRequestId = data.offboardingRequestId;
        }
        return callWithRetry({
            path: INQUIRE_REGISTRATION_PATH,
            body: requestBody,
        });
    },
    /**
     * Offboard a merchant (guide section 4.4).
     * Uses separate offboardingRequestId.
     */
    async offboard(data) {
        const { parentMerchantId } = config_1.config.antom;
        if (!parentMerchantId) {
            throw new Error('PARENT_MERCHANT_ID is not configured');
        }
        const requestBody = {
            offboardingRequestId: data.offboardingRequestId,
            merchant: {
                parentMerchantId,
                referenceMerchantId: data.referenceMerchantId,
            },
        };
        return callWithRetry({
            path: OFFBOARD_PATH,
            body: requestBody,
        });
    },
    /**
     * Deactivate a payment method.
     */
    async deactivate(registrationRequestId, paymentMethodType) {
        return callWithRetry({
            path: DEACTIVATE_PATH,
            body: { registrationRequestId, paymentMethodType },
        });
    },
    /**
     * Query KYB information from Antom using WF access token.
     * This is used after user logs in with WorldFirst and authorizes to share KYB info.
     */
    async queryKybInfo(accessToken, customerId) {
        if (config_1.config.mockMode) {
            console.log(`[Antom][Mock] queryKybInfo >>> request: accessToken=${accessToken}, customerId=${customerId}`);
            // Mock KYB data for demo
            const mockResult = {
                success: true,
                kybData: {
                    // Company info
                    legalName: 'Mock Company Limited',
                    companyType: 'ENTERPRISE',
                    incorporationDate: '2011-12-03+01:00',
                    vatNo: '123456',
                    // Certificates with fileList (nested structure)
                    certificates: [
                        {
                            certificateNo: '91310000MA1FL5XX0X',
                            certificateType: 'ENTERPRISE_REGISTRATION',
                            fileList: [
                                {
                                    fileName: 'business_license.jpeg',
                                    fileUrl: 'https://pics1.baidu.com/feed/a5c27d1ed21b0ef4d0d3794da512ecd780cb3eca.jpeg',
                                },
                            ],
                            registrationCertificate: true,
                        },
                    ],
                    // Also keep flat fields for KycInfo DB storage
                    certificateType: 'ENTERPRISE_REGISTRATION',
                    certificateNo: '91310000MA1FL5XX0X',
                    branchName: 'Headquarters',
                    companyUnit: 'HEADQUARTERS',
                    // Registered address
                    addressRegion: 'SG',
                    addressState: 'Singapore',
                    addressCity: 'Singapore',
                    address1: '123 Mock Street',
                    address2: 'Tower A, Floor 15',
                    zipCode: '200120',
                    // Business info
                    appName: 'Mock Online Store',
                    merchantBrandName: 'MockBrand',
                    mcc: '5812',
                    doingBusinessAs: 'MockCaféTopPlaza',
                    websiteUrl: 'https://order.ds.alipayplus.com',
                    englishName: 'Mock Company Ltd.',
                    serviceDescription: 'Online retail and e-commerce services',
                    // Contact
                    contactType: 'EMAIL',
                    contactInfo: 'contact@mock-company.com',
                    // Legal representative
                    legalRepName: '李四',
                    legalRepIdType: 'ID_CARD',
                    legalRepIdNo: '310101199203055678',
                    legalRepDob: '1992-03-05',
                    // Entity associations with nested individual/company structures
                    entityAssociations: [
                        {
                            associationType: 'UBO',
                            legalEntityType: 'INDIVIDUAL',
                            individual: {
                                name: { fullName: 'NGCHUNKONG' },
                                nationality: 'SG',
                                certificates: [
                                    {
                                        certificateNo: 'S8413692A',
                                        certificateType: 'ID_CARD',
                                        fileList: [
                                            {
                                                fileName: 'ubo_id_card.jpeg',
                                                fileUrl: 'https://pics1.baidu.com/feed/a5c27d1ed21b0ef4d0d3794da512ecd780cb3eca.jpeg',
                                            },
                                        ],
                                        registrationCertificate: false,
                                    },
                                ],
                            },
                        },
                        {
                            associationType: 'BOARD_MEMBER',
                            legalEntityType: 'INDIVIDUAL',
                            individual: {
                                name: { fullName: 'NGCHUNKONG' },
                                nationality: 'SG',
                                certificates: [
                                    {
                                        certificateNo: 'S8413692A',
                                        certificateType: 'ID_CARD',
                                        fileList: [
                                            {
                                                fileName: 'director_id_card.jpeg',
                                                fileUrl: 'https://pics1.baidu.com/feed/a5c27d1ed21b0ef4d0d3794da512ecd780cb3eca.jpeg',
                                            },
                                        ],
                                        registrationCertificate: false,
                                    },
                                ],
                            },
                        },
                        {
                            associationType: 'HOLDING_COMPANY',
                            legalEntityType: 'COMPANY',
                            company: {
                                legalName: 'Mock Holding Ltd.',
                                companyType: 'ENTERPRISE',
                                certificates: [
                                    {
                                        certificateNo: 'T09LL0001B',
                                        certificateType: 'ENTERPRISE_REGISTRATION',
                                        fileList: [
                                            {
                                                fileName: 'holding_company_cert.jpeg',
                                                fileUrl: 'https://pics1.baidu.com/feed/a5c27d1ed21b0ef4d0d3794da512ecd780cb3eca.jpeg',
                                            },
                                        ],
                                        registrationCertificate: false,
                                    },
                                ],
                            },
                        },
                    ],
                    // Stores with attachments
                    stores: [
                        {
                            name: 'MockCaféTopPlaza',
                            referenceStoreId: '202504109204091680138064',
                            region: 'SG',
                            mcc: '5812',
                            address: {
                                address1: '123 Mock Street',
                                city: 'Singapore',
                                region: 'SG',
                                state: 'Singapore',
                            },
                            attachments: [
                                {
                                    attachmentType: 'SHOP_DOOR_HEAD_PIC',
                                    fileList: [
                                        {
                                            fileName: 'shop_door.jpeg',
                                            fileUrl: 'https://pics1.baidu.com/feed/a5c27d1ed21b0ef4d0d3794da512ecd780cb3eca.jpeg',
                                        },
                                    ],
                                },
                                {
                                    attachmentType: 'SHOP_INSIDE_PIC',
                                    fileList: [
                                        {
                                            fileName: 'shop_inside.jpeg',
                                            fileUrl: 'https://pics1.baidu.com/feed/a5c27d1ed21b0ef4d0d3794da512ecd780cb3eca.jpeg',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            };
            console.log(`[Antom][Mock] queryKybInfo <<< response: success=${mockResult.success}, kybData keys=${Object.keys(mockResult.kybData)}`);
            return mockResult;
        }
        try {
            // queryKybInfo uses WF credentials, not Antom credentials
            const baseUrl = 'https://open-sea-global.alipay.com';
            const apiPath = QUERY_KYB_PATH;
            const url = `${baseUrl}${apiPath}`;
            const requestBody = { accessToken };
            if (customerId) {
                requestBody.customerId = customerId;
            }
            const requestTime = new Date().toISOString().replace('Z', '+00:00');
            const bodyStr = JSON.stringify(requestBody);
            const signature = (0, crypto_1.signRequest)(apiPath, config_1.config.wf.oauthClientID, requestTime, bodyStr, config_1.config.wf.privateKey);
            const signatureHeader = (0, crypto_1.buildSignatureHeader)(signature);
            const headers = {
                'Content-Type': 'application/json; charset=UTF-8',
                'client-id': config_1.config.wf.oauthClientID,
                'Request-Time': requestTime,
                'Signature': signatureHeader,
            };
            console.log(`[WF] queryKybInfo >>> ${url}`);
            console.log(`[WF] queryKybInfo >>> headers:`, JSON.stringify(headers, null, 2));
            console.log(`[WF] queryKybInfo >>> body: ${bodyStr}`);
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: bodyStr,
            });
            const responseText = await response.text();
            console.log(`[WF] queryKybInfo <<< status=${response.status}, body=${responseText}`);
            let data;
            try {
                data = JSON.parse(responseText);
            }
            catch {
                throw new Error(`queryKybInfo returned invalid JSON: ${responseText.substring(0, 200)}`);
            }
            const result = data.result;
            const status = result?.resultStatus;
            if (status === 'S') {
                // Extract and flatten KYB data from WF response
                // WF returns nested structure: { merchant: { businessInfo: {...}, company: {...}, ... } }
                // Frontend expects flat structure: { legalName, companyType, address1, ... }
                const merchant = data.merchant;
                if (!merchant) {
                    return { success: true, kybData: {} };
                }
                const company = merchant.company;
                const businessInfo = merchant.businessInfo;
                const registeredAddress = company?.registeredAddress;
                // Flatten nested WF merchant structure to match frontend KYC form fields
                const kybData = {
                    // Company info
                    legalName: company?.legalName || '',
                    companyType: company?.companyType || '',
                    incorporationDate: company?.incorporationDate || '',
                    vatNo: company?.vatNo || '',
                    branchName: company?.branchName || '',
                    companyUnit: company?.companyUnit || '',
                    // Certificates (nested structure preserved for rich data)
                    certificates: company?.certificates || [],
                    // Flat certificate fields for DB storage
                    certificateType: '',
                    certificateNo: '',
                    // Registered address
                    addressRegion: registeredAddress?.region || '',
                    addressState: registeredAddress?.state || '',
                    addressCity: registeredAddress?.city || '',
                    address1: registeredAddress?.address1 || '',
                    address2: registeredAddress?.address2 || '',
                    zipCode: registeredAddress?.zipCode || '',
                    // Business info
                    appName: businessInfo?.appName || '',
                    merchantBrandName: businessInfo?.merchantBrandName || '',
                    mcc: businessInfo?.mcc || businessInfo?.industryType || '',
                    doingBusinessAs: businessInfo?.doingBusinessAs || '',
                    englishName: businessInfo?.englishName || '',
                    serviceDescription: businessInfo?.serviceDescription || '',
                    // Website
                    websiteUrl: '',
                    // Contact
                    contactType: '',
                    contactInfo: '',
                    // Entity associations (preserve nested structure)
                    entityAssociations: merchant.entityAssociations || [],
                    // Stores (preserve nested structure)
                    stores: merchant.stores || [],
                    // Keep the full merchant object for any fields we might have missed
                    _rawMerchant: merchant,
                };
                // Extract first certificate info for flat fields
                const certs = company?.certificates;
                if (certs && certs.length > 0) {
                    kybData.certificateType = certs[0].certificateType || '';
                    kybData.certificateNo = certs[0].certificateNo || '';
                }
                // Extract website from businessInfo.websites array
                const websites = businessInfo?.websites;
                if (websites && websites.length > 0) {
                    kybData.websiteUrl = websites[0].url || '';
                }
                // Extract contact from company.contactMethods
                const contacts = company?.contactMethods;
                if (contacts && contacts.length > 0) {
                    kybData.contactType = contacts[0].contactMethodType || '';
                    kybData.contactInfo = contacts[0].contactMethodInfo || '';
                }
                console.log('[WF] queryKybInfo flattened kybData keys:', Object.keys(kybData));
                return { success: true, kybData };
            }
            else {
                const code = result?.resultCode || 'UNKNOWN';
                const msg = result?.resultMessage || 'Failed to query KYB info';
                console.error(`[WF] queryKybInfo business error: ${code} - ${msg}`);
                return { success: false, error: `${code} - ${msg}` };
            }
        }
        catch (error) {
            console.error('[WF] queryKybInfo error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    },
    /**
     * Query payout accounts for a merchant.
     */
    async queryPayoutAccounts(referenceMerchantId, settlementCurrencyList) {
        return callWithRetry({
            path: QUERY_PAYOUT_ACCOUNTS_PATH,
            body: { referenceMerchantId, settlementCurrencyList },
        });
    },
    /**
     * Query payout settings for a merchant and currency.
     */
    async queryPayoutSettings(referenceMerchantId, settlementCurrency) {
        return callWithRetry({
            path: QUERY_PAYOUT_SETTINGS_PATH,
            body: { referenceMerchantId, settlementCurrency },
        });
    },
    /**
     * Update payout settings for a merchant.
     */
    async updatePayoutSettings(data) {
        return callWithRetry({
            path: UPDATE_PAYOUT_SETTINGS_PATH,
            body: data,
        });
    },
};
//# sourceMappingURL=antomService.js.map