// Merchant
export type MerchantStatus = 'ACTIVE' | 'INACTIVE' | 'OFFBOARDED';
export type KycStatus = 'INIT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPPLEMENT_REQUIRED';

// Payment Method
export type PaymentMethodStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE';

// Notification
export type NotificationType =
  | 'REGISTRATION_STATUS'
  | 'PAYMENT_METHOD_ACTIVATION_STATUS'
  | 'RISK_NOTIFICATION';

// --- Antom API result types ---

export interface AntomResultInfo {
  resultCode: string;
  resultCodeId?: string;
  resultMessage?: string;
  resultStatus: 'S' | 'U' | 'F';
}

// Legacy result shape (kept for backward compat)
export interface AntomResult {
  resultStatus: 'S' | 'F' | 'U';
  resultCode: string;
  resultMessage: string;
}

export interface AntomResponse {
  result?: AntomResult;
  resultInfo?: AntomResultInfo;
  registrationResult?: AntomRegistrationResult;
  [key: string]: unknown;
}

// --- Antom register request types (guide section 4.1) ---

export interface AntomFileItem {
  fileName: string;
  fileUrl: string;
}

export interface AntomCertificate {
  certificateNo?: string;
  certificateType?: string;
  fileList?: AntomFileItem[];
  registrationCertificate?: boolean;
}

export interface AntomAddress {
  address1?: string;
  address2?: string;
  city?: string;
  region?: string;
  state?: string;
  zipCode?: string;
}

export interface AntomStoreAttachment {
  attachmentType: string;
  fileList: AntomFileItem[];
}

export interface AntomStore {
  name?: string;
  referenceStoreId?: string;
  region?: string;
  mcc?: string;
  address?: AntomAddress;
  attachments?: AntomStoreAttachment[];
}

export interface AntomEntityAssociationIndividual {
  name: { firstName?: string; lastName?: string; fullName?: string };
  nationality?: string;
  dateOfBirth?: string;
  certificates?: AntomCertificate[];
}

export interface AntomEntityAssociationCompany {
  legalName?: string;
  companyType?: string;
  certificates?: AntomCertificate[];
}

export interface AntomEntityAssociation {
  associationType: string;
  legalEntityType: string;
  shareholdingRatio?: number;
  individual?: AntomEntityAssociationIndividual;
  company?: AntomEntityAssociationCompany;
}

export interface AntomRegisterRequest {
  registrationRequestId: string;
  partnerId?: string;
  merchant: {
    loginId: string;
    legalEntityType: 'COMPANY';
    integrationPartnerId?: string;
    referenceMerchantId: string;
    businessInfo: {
      appName?: string;
      doingBusinessAs?: string;
      englishName?: string;
      mcc?: string;
      merchantBrandName?: string;
      serviceDescription?: string;
      websites?: { type: string; url: string }[];
    };
    company: {
      branchName?: string;
      companyType?: string;
      companyUnit?: string;
      legalName?: string;
      incorporationDate?: string;
      vatNo?: string;
      certificates?: AntomCertificate[];
      registeredAddress?: AntomAddress;
      contactMethods?: {
        contactMethodInfo: string;
        contactMethodType: string;
      }[];
    };
    entityAssociations?: AntomEntityAssociation[];
    stores?: AntomStore[];
  };
  settlementInfoList?: {
    settlementCurrency: string;
    settlementAccountType?: string;
    settlementAccountInfo?: { accountNo: string };
  }[];
  paymentMethodActivationRequests: {
    paymentMethodType: string;
    productCodes: string[];
  }[];
}

// --- Antom inquire registration status types (guide section 4.2) ---

export interface AntomInquireRequest {
  registrationRequestId?: string;
  offboardingRequestId?: string;
  referenceMerchantId: string;
}

export interface AntomRegistrationResult {
  registrationStatus: 'PROCESSING' | 'SUCCESS' | 'FAIL';
  registrationRequestId?: string;
  loginId?: string;
  parentMerchantId?: string;
  referenceMerchantId?: string;
  failReasonType?: string;
  failReasonDescription?: string;
}

export interface AntomOffboardingResult {
  offboardingStatus: 'PROCESSING' | 'SUCCESS' | 'FAIL';
  offboardingRequestId?: string;
  parentMerchantId?: string;
  referenceMerchantId?: string;
}

// --- Antom offboard request types (guide section 4.4) ---

export interface AntomOffboardRequest {
  offboardingRequestId: string;
  merchant?: {
    parentMerchantId: string;
    referenceMerchantId: string;
  };
}

// --- Notification payloads ---

// Antom guide format (section 4.3): notifications use notificationType + nested result
export interface AntomNotification {
  notifyId: string;
  notificationType: string;      // guide uses notificationType
  notifyType?: string;           // legacy alias (kept for mock compat)
  registrationRequestId?: string; // convenience flat field

  // Nested result per guide spec
  merchantRegistrationResult?: {
    registrationStatus: string; // SUCCESS, FAIL, PROCESSING
    registrationRequestId: string;
    parentMerchantId?: string;
    referenceMerchantId?: string;
    failReasonType?: string;
    failReasonDescription?: string;
  };

  merchantOffboardingResult?: {
    offboardingStatus: string;
    offboardingRequestId: string;
    parentMerchantId?: string;
    referenceMerchantId?: string;
  };

  // Internal extensions for payment method and risk notifications (mock/demo)
  paymentMethodType?: string;
  paymentMethodStatus?: string;
  riskLevel?: string;
  riskReasonCodes?: string[];

  // Legacy flat fields for SUPPLEMENT_REQUIRED (demo extension)
  registrationStatus?: string;
  kycStatus?: string;
  rejectedFields?: string[];
  rejectedReason?: string;

  [key: string]: unknown;
}

// WebSocket messages
export interface WsMessage {
  type: 'NOTIFICATION' | 'STATUS_CHANGE';
  data: Record<string, unknown>;
}

// Mock trigger request
export interface MockNotifyRequest {
  merchantId: string;
  notificationType: NotificationType;
  data: Record<string, unknown>;
}
