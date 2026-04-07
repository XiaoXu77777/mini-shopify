import { config } from '../utils/config';
import { signRequest, verifySignature, buildSignatureHeader, parseSignatureHeader } from '../utils/crypto';
import type { AntomResponse, AntomRegisterRequest, AntomInquireRequest, AntomOffboardRequest } from '../types';

const REGISTER_PATH = '/ams/api/v1/isv/register';
const INQUIRE_REGISTRATION_PATH = '/ams/api/v1/isv/inquiry_register';
const OFFBOARD_PATH = '/ams/api/v1/isv/offboard';
const DEACTIVATE_PATH = '/ams/api/v1/isv/deactivate';
const QUERY_KYB_PATH = '/ams/v1/merchant/queryKybInfo';

interface AntomRequestOptions {
  path: string;
  body: Record<string, unknown>;
}

async function callAntomApi(options: AntomRequestOptions): Promise<AntomResponse> {
  const { path, body } = options;
  const requestBody = JSON.stringify(body);
  const requestTime = Date.now().toString();
  const { clientId, privateKey, publicKey, baseUrl, agentToken } = config.antom;

  // Generate signature
  const signature = signRequest(path, clientId, requestTime, requestBody, privateKey);
  const signatureHeader = buildSignatureHeader(signature);

  // Build request
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Client-Id': clientId,
    'Request-Time': requestTime,
    'Signature': signatureHeader,
  };

  if (agentToken) {
    headers['agent-token'] = agentToken;
  }

  // Send request
  console.log(`[Antom] >>> ${path} | clientId=${clientId} | requestTime=${requestTime}`);
  console.log(`[Antom] >>> Request body: ${requestBody.substring(0, 500)}${requestBody.length > 500 ? '...' : ''}`);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: requestBody,
  });

  const responseBody = await response.text();

  console.log(`[Antom] <<< ${path} | HTTP ${response.status} ${response.statusText}`);
  console.log(`[Antom] <<< Response body: ${responseBody.substring(0, 1000)}${responseBody.length > 1000 ? '...' : ''}`);

  // Verify response signature
  const respClientId = response.headers.get('client-id') || clientId;
  const respTime = response.headers.get('response-time') || '';
  const respSignature = response.headers.get('signature') || '';

  if (respSignature && publicKey) {
    const parsed = parseSignatureHeader(respSignature);
    if (parsed) {
      const isValid = verifySignature(path, respClientId, respTime, responseBody, parsed.signature, publicKey);
      if (!isValid) {
        console.error(`[Antom] !!! Signature verification failed for ${path}`);
        throw new Error('Antom response signature verification failed');
      }
    }
  }

  try {
    return JSON.parse(responseBody) as AntomResponse;
  } catch (e) {
    console.error(`[Antom] !!! Failed to parse response JSON for ${path}:`, e);
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
 */
function buildRegisterRequest(data: RegisterData): AntomRegisterRequest {
  const kyc = data.kycInfo;
  const { parentMerchantId } = config.antom;

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

  // Add certificate if present
  if (kyc?.certificateNo || kyc?.certificateType) {
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

  // Build entityAssociations
  const entityAssociations = data.entityAssociations?.map((ea) => ({
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

  // Build settlementInfoList (differs by WF account presence)
  const settlementInfoList: AntomRegisterRequest['merchant']['settlementInfoList'] = data.merchant.wfAccountId
    ? [
        {
          settlementAccountType: 'WORLD_FIRST_ACCOUNT',
          settlementAccountInfo: { accountNo: data.merchant.wfAccountId },
          settlementCurrency: data.merchant.settlementCurrency,
        },
      ]
    : [{ settlementCurrency: data.merchant.settlementCurrency }];

  // Build paymentMethodOpenRequests
  const paymentMethodOpenRequests = data.paymentMethodTypes.map((pmType) => ({
    paymentMethodType: pmType,
    productCodes: ['CASHIER_PAYMENT'],
  }));

  return {
    registrationRequestId: data.registrationRequestId,
    merchant: {
      loginId: data.merchant.email,
      legalEntityType: 'COMPANY',
      parentMerchantId,
      referenceMerchantId: data.merchant.referenceMerchantId,
      businessInfo,
      company,
      entityAssociations: entityAssociations && entityAssociations.length > 0 ? entityAssociations : undefined,
      settlementInfoList,
    },
    paymentMethodOpenRequests,
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
          certificateType: 'ENTERPRISE_REGISTRATION',
          certificateNo: '91310000MA1FL5XX0X',
          branchName: 'Headquarters',
          companyUnit: 'HEADQUARTERS',
          // Registered address
          addressRegion: 'CN',
          addressState: 'Shanghai',
          addressCity: 'Shanghai',
          address1: '999 Pudong Avenue',
          address2: 'Tower A, Floor 15',
          zipCode: '200120',
          // Business info
          appName: 'Mock Online Store',
          merchantBrandName: 'MockBrand',
          mcc: '5732',
          doingBusinessAs: 'Mock E-Commerce',
          websiteUrl: 'https://mock-store.example.com',
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
          // Entity associations (directors/UBOs)
          entityAssociations: [
            {
              associationType: 'UBO',
              fullName: '李四',
              shareholdingRatio: '60',
              idType: 'ID_CARD',
              idNo: '310101199203055678',
              dateOfBirth: '1992-03-05',
            },
            {
              associationType: 'DIRECTOR',
              fullName: '王五',
              shareholdingRatio: '40',
              idType: 'PASSPORT',
              idNo: 'E12345678',
              dateOfBirth: '1988-08-15',
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
