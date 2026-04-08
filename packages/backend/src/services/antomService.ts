import { config } from '../utils/config';
import { signRequest, verifySignature, buildSignatureHeader, parseSignatureHeader } from '../utils/crypto';
import type { AntomResponse, AntomRegisterRequest, AntomInquireRequest, AntomOffboardRequest, AntomStore } from '../types';

// API paths (production format, sandbox prefix will be added dynamically)
const REGISTER_PATH = '/ams/api/v1/merchants/register';
const INQUIRE_REGISTRATION_PATH = '/ams/api/v1/merchants/inquiryRegistration';
const OFFBOARD_PATH = '/ams/api/v1/merchants/offboard';
const DEACTIVATE_PATH = '/ams/api/v1/merchants/deactivate';
const QUERY_KYB_PATH = '/ams/v1/merchant/queryKybInfo';

/**
 * Get the actual API path, inserting /sandbox/ prefix for sandbox environment.
 * Production: /ams/api/v1/merchants/register
 * Sandbox:    /ams/sandbox/api/v1/merchants/register
 */
function getApiPath(path: string): string {
  if (!config.antom.sandbox) return path;
  // Insert 'sandbox' after '/ams/'
  return path.replace('/ams/', '/ams/sandbox/');
}

interface AntomRequestOptions {
  path: string;
  body: Record<string, unknown>;
}

async function callAntomApi(options: AntomRequestOptions): Promise<AntomResponse> {
  const { path, body } = options;
  const requestBody = JSON.stringify(body);
  const requestTime = Date.now().toString();
  const { clientId, privateKey, publicKey, baseUrl, agentToken } = config.antom;

  // Resolve actual URL path (with sandbox prefix if needed)
  // Note: sandbox prefix is only for URL routing, signature uses the original path
  const actualPath = getApiPath(path);

  // Generate signature (use original path without sandbox prefix)
  const signature = signRequest(path, clientId, requestTime, requestBody, privateKey);
  const signatureHeader = buildSignatureHeader(signature);

  // Build request
  const url = `${baseUrl}${actualPath}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Client-Id': clientId,
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
    return JSON.parse(responseBody) as AntomResponse;
  } catch (e) {
    console.error(`[Antom] !!! Failed to parse response JSON for ${actualPath}:`, e);
    console.error(`[Antom] !!! Raw response body: ${responseBody}`);
    throw new Error(`Antom API response is not valid JSON (HTTP ${response.status}): ${responseBody.substring(0, 200)}`);
  }
}

/**
 * Retry helper for Antom API calls.
 * Retries on resultStatus 'U' (Unknown/retryable) with exponential backoff.
 */
async function callWithRetry(
  options: AntomRequestOptions,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<AntomResponse> {
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

// --- Data types for building register request ---

interface RegisterData {
  registrationRequestId: string;
  merchant: {
    email: string;
    referenceMerchantId: string;
    wfAccountId?: string;
    settlementCurrency: string;
  };
  kycInfo?: {
    legalName?: string | null;
    companyType?: string | null;
    certificateType?: string | null;
    certificateNo?: string | null;
    branchName?: string | null;
    companyUnit?: string | null;
    addressRegion?: string | null;
    addressState?: string | null;
    addressCity?: string | null;
    address1?: string | null;
    address2?: string | null;
    zipCode?: string | null;
    mcc?: string | null;
    doingBusinessAs?: string | null;
    websiteUrl?: string | null;
    englishName?: string | null;
    serviceDescription?: string | null;
    appName?: string | null;
    merchantBrandName?: string | null;
    contactType?: string | null;
    contactInfo?: string | null;
    // wfKycData contains the full KYB response with nested structures
    // (stores, entityAssociations with individual/company, certificates with fileList, etc.)
    wfKycData?: string | null;
  } | null;
  entityAssociations?: {
    associationType: string;
    shareholdingRatio?: string | null;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    dateOfBirth?: string | null;
    idType?: string | null;
    idNo?: string | null;
  }[];
  paymentMethodTypes: string[];
}

/**
 * Build the nested Antom register request body from flat DB data.
 * Uses wfKycData (the full KYB response) for rich nested structures like
 * stores, entityAssociations (INDIVIDUAL/COMPANY), certificates with fileList, etc.
 */
function buildRegisterRequest(data: RegisterData): AntomRegisterRequest {
  const kyc = data.kycInfo;
  const { parentMerchantId } = config.antom;

  // Parse wfKycData if available (contains the full KYB response with nested structures)
  let wfKyc: Record<string, unknown> | null = null;
  if (kyc?.wfKycData) {
    try {
      wfKyc = typeof kyc.wfKycData === 'string' ? JSON.parse(kyc.wfKycData) : kyc.wfKycData;
    } catch {
      console.warn('[Antom] Failed to parse wfKycData, ignoring rich structures');
    }
  }

  // Build company object
  const company: AntomRegisterRequest['merchant']['company'] = {
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
    company.certificates = (wfKyc.certificates as Record<string, unknown>[]).map((cert) => ({
      certificateNo: cert.certificateNo ? String(cert.certificateNo) : undefined,
      certificateType: cert.certificateType ? String(cert.certificateType) : undefined,
      fileList: Array.isArray(cert.fileList)
        ? (cert.fileList as Record<string, unknown>[]).map((f) => ({
            fileName: String(f.fileName || ''),
            fileUrl: String(f.fileUrl || ''),
          }))
        : undefined,
      registrationCertificate: cert.registrationCertificate != null
        ? Boolean(cert.registrationCertificate)
        : undefined,
    }));
  } else if (kyc?.certificateNo || kyc?.certificateType) {
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
  const businessInfo: AntomRegisterRequest['merchant']['businessInfo'] = {
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
  let entityAssociations: AntomRegisterRequest['merchant']['entityAssociations'] | undefined;

  if (wfKyc?.entityAssociations && Array.isArray(wfKyc.entityAssociations)) {
    entityAssociations = (wfKyc.entityAssociations as Record<string, unknown>[]).map((ea) => {
      const legalEntityType = String(ea.legalEntityType || 'INDIVIDUAL');
      const assoc: AntomRegisterRequest['merchant']['entityAssociations'] extends (infer T)[] | undefined ? T : never = {
        associationType: String(ea.associationType || ''),
        legalEntityType,
      };

      if (legalEntityType === 'INDIVIDUAL' && ea.individual) {
        const ind = ea.individual as Record<string, unknown>;
        assoc.individual = {
          name: ind.name
            ? {
                firstName: (ind.name as Record<string, unknown>).firstName
                  ? String((ind.name as Record<string, unknown>).firstName)
                  : undefined,
                lastName: (ind.name as Record<string, unknown>).lastName
                  ? String((ind.name as Record<string, unknown>).lastName)
                  : undefined,
                fullName: (ind.name as Record<string, unknown>).fullName
                  ? String((ind.name as Record<string, unknown>).fullName)
                  : undefined,
              }
            : { fullName: undefined },
          nationality: ind.nationality ? String(ind.nationality) : undefined,
          dateOfBirth: ind.dateOfBirth ? String(ind.dateOfBirth) : undefined,
          certificates: Array.isArray(ind.certificates)
            ? (ind.certificates as Record<string, unknown>[]).map((cert) => ({
                certificateNo: cert.certificateNo ? String(cert.certificateNo) : undefined,
                certificateType: cert.certificateType ? String(cert.certificateType) : undefined,
                fileList: Array.isArray(cert.fileList)
                  ? (cert.fileList as Record<string, unknown>[]).map((f) => ({
                      fileName: String(f.fileName || ''),
                      fileUrl: String(f.fileUrl || ''),
                    }))
                  : undefined,
                registrationCertificate: cert.registrationCertificate != null
                  ? Boolean(cert.registrationCertificate)
                  : undefined,
              }))
            : undefined,
        };
      } else if (legalEntityType === 'COMPANY' && ea.company) {
        const comp = ea.company as Record<string, unknown>;
        assoc.company = {
          legalName: comp.legalName ? String(comp.legalName) : undefined,
          companyType: comp.companyType ? String(comp.companyType) : undefined,
          certificates: Array.isArray(comp.certificates)
            ? (comp.certificates as Record<string, unknown>[]).map((cert) => ({
                certificateNo: cert.certificateNo ? String(cert.certificateNo) : undefined,
                certificateType: cert.certificateType ? String(cert.certificateType) : undefined,
                fileList: Array.isArray(cert.fileList)
                  ? (cert.fileList as Record<string, unknown>[]).map((f) => ({
                      fileName: String(f.fileName || ''),
                      fileUrl: String(f.fileUrl || ''),
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
  } else if (data.entityAssociations && data.entityAssociations.length > 0) {
    // Fallback to flat DB entity associations (legacy path)
    entityAssociations = data.entityAssociations.map((ea) => ({
      associationType: ea.associationType,
      legalEntityType: 'INDIVIDUAL' as const,
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
  let stores: AntomRegisterRequest['merchant']['stores'] | undefined;
  if (wfKyc?.stores && Array.isArray(wfKyc.stores)) {
    stores = (wfKyc.stores as Record<string, unknown>[]).map((store) => {
      const s: AntomStore = {
        name: store.name ? String(store.name) : undefined,
        referenceStoreId: store.referenceStoreId ? String(store.referenceStoreId) : undefined,
        region: store.region ? String(store.region) : undefined,
        mcc: store.mcc ? String(store.mcc) : undefined,
      };

      if (store.address && typeof store.address === 'object') {
        const addr = store.address as Record<string, unknown>;
        s.address = {
          address1: addr.address1 ? String(addr.address1) : undefined,
          address2: addr.address2 ? String(addr.address2) : undefined,
          city: addr.city ? String(addr.city) : undefined,
          region: addr.region ? String(addr.region) : undefined,
          state: addr.state ? String(addr.state) : undefined,
        };
      }

      if (Array.isArray(store.attachments)) {
        s.attachments = (store.attachments as Record<string, unknown>[]).map((att) => ({
          attachmentType: String(att.attachmentType || ''),
          fileList: Array.isArray(att.fileList)
            ? (att.fileList as Record<string, unknown>[]).map((f) => ({
                fileName: String(f.fileName || ''),
                fileUrl: String(f.fileUrl || ''),
              }))
            : [],
        }));
      }

      return s;
    });
  }

  // Build settlementInfoList (top-level, differs by WF account presence)
  const settlementInfoList: AntomRegisterRequest['settlementInfoList'] = data.merchant.wfAccountId
    ? [
        {
          settlementAccountType: 'WORLD_FIRST_ACCOUNT',
          settlementAccountInfo: { accountNo: data.merchant.wfAccountId },
          settlementCurrency: data.merchant.settlementCurrency,
        },
      ]
    : [{ settlementCurrency: data.merchant.settlementCurrency }];

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

export const antomService = {
  /**
   * Register a merchant with Antom (guide section 4.1).
   * Builds nested merchant object from flat DB data.
   */
  async register(data: RegisterData): Promise<AntomResponse> {
    const requestBody = buildRegisterRequest(data);

    if (config.mockMode) {
      return {
        resultInfo: {
          resultStatus: 'S',
          resultCode: 'SUCCESS',
          resultMessage: 'success',
        },
        registrationResult: {
          registrationStatus: 'PROCESSING',
          registrationRequestId: data.registrationRequestId,
          loginId: data.merchant.email,
          parentMerchantId: config.antom.parentMerchantId,
          referenceMerchantId: data.merchant.referenceMerchantId,
        },
      };
    }

    return callWithRetry({
      path: REGISTER_PATH,
      body: requestBody as unknown as Record<string, unknown>,
    });
  },

  /**
   * Query registration or offboarding status (guide section 4.2).
   */
  async inquireRegistrationStatus(data: {
    registrationRequestId?: string;
    offboardingRequestId?: string;
    referenceMerchantId: string;
  }): Promise<AntomResponse> {
    const { parentMerchantId } = config.antom;

    const requestBody: AntomInquireRequest = {
      merchant: {
        parentMerchantId,
        referenceMerchantId: data.referenceMerchantId,
      },
    };

    if (data.registrationRequestId) {
      requestBody.registrationRequestId = data.registrationRequestId;
    }
    if (data.offboardingRequestId) {
      requestBody.offboardingRequestId = data.offboardingRequestId;
    }

    if (config.mockMode) {
      // In mock mode, return current status from DB (handled at route level)
      return {
        resultInfo: {
          resultStatus: 'S',
          resultCode: 'SUCCESS',
          resultMessage: 'success',
        },
        registrationResult: {
          registrationStatus: 'PROCESSING',
          registrationRequestId: data.registrationRequestId,
          parentMerchantId,
          referenceMerchantId: data.referenceMerchantId,
        },
      };
    }

    return callWithRetry({
      path: INQUIRE_REGISTRATION_PATH,
      body: requestBody as unknown as Record<string, unknown>,
    });
  },

  /**
   * Offboard a merchant (guide section 4.4).
   * Uses separate offboardingRequestId.
   */
  async offboard(data: {
    offboardingRequestId: string;
    referenceMerchantId: string;
  }): Promise<AntomResponse> {
    const { parentMerchantId } = config.antom;

    const requestBody: AntomOffboardRequest = {
      offboardingRequestId: data.offboardingRequestId,
      merchant: {
        parentMerchantId,
        referenceMerchantId: data.referenceMerchantId,
      },
    };

    if (config.mockMode) {
      return {
        resultInfo: {
          resultStatus: 'S',
          resultCode: 'SUCCESS',
          resultMessage: 'success',
        },
        merchantOffboardingResult: {
          offboardingStatus: 'PROCESSING',
          offboardingRequestId: data.offboardingRequestId,
          parentMerchantId,
          referenceMerchantId: data.referenceMerchantId,
        },
      };
    }

    return callWithRetry({
      path: OFFBOARD_PATH,
      body: requestBody as unknown as Record<string, unknown>,
    });
  },

  /**
   * Deactivate a payment method.
   */
  async deactivate(registrationRequestId: string, paymentMethodType: string): Promise<AntomResponse> {
    if (config.mockMode) {
      return {
        resultInfo: {
          resultStatus: 'S',
          resultCode: 'SUCCESS',
          resultMessage: 'success',
        },
      };
    }

    return callWithRetry({
      path: DEACTIVATE_PATH,
      body: { registrationRequestId, paymentMethodType },
    });
  },

  /**
   * Query KYB information from Antom using WF access token.
   * This is used after user logs in with WorldFirst and authorizes to share KYB info.
   */
  async queryKybInfo(accessToken: string, customerId: string): Promise<{
    success: boolean;
    kybData?: Record<string, unknown>;
    error?: string;
  }> {
    //测试账号没那么多wf账号，都走mock
    if (1) {
      // Mock KYB data for demo
      return {
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
    }

    try {
      const requestBody = {
        accessToken,
        customerId,
      };

      const response = await callWithRetry({
        path: QUERY_KYB_PATH,
        body: requestBody,
      });

      const status = response.resultInfo?.resultStatus || response.result?.resultStatus;
      if (status === 'S') {
        return {
          success: true,
          kybData: (response as Record<string, unknown>).customer 
            ? ((response as Record<string, unknown>).customer as Record<string, unknown>).businessPartner as Record<string, unknown>
            : response as unknown as Record<string, unknown>,
        };
      } else {
        return {
          success: false,
          error: response.resultInfo?.resultMessage || 'Failed to query KYB info',
        };
      }
    } catch (error) {
      console.error('[Antom] Query KYB error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
