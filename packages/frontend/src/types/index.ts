export type MerchantStatus = 'ACTIVE' | 'INACTIVE' | 'OFFBOARDED';
export type KycStatus = 'INIT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPPLEMENT_REQUIRED';
export type PaymentMethodStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE';
export type NotificationType =
  | 'REGISTRATION_STATUS'
  | 'PAYMENT_METHOD_ACTIVATION_STATUS'
  | 'RISK_NOTIFICATION'
  | 'MERCHANT_RISK_SCORE_NOTIFICATION';

export interface Merchant {
  id: string;
  shopName: string;
  region: string;
  email: string;
  wfAccountId: string | null;
  referenceMerchantId: string | null;
  antomMerchantId: string | null;
  kycStatus: KycStatus;
  riskLevel: string | null;
  riskReasonCodes: string[] | null;
  registrationRequestId: string | null;
  offboardingRequestId: string | null;
  settlementCurrency: string;
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
  kycInfo?: KycInfo | null;
  paymentMethods: PaymentMethod[];
  entityAssociations?: EntityAssociation[];
}

export interface KycInfo {
  id: string;
  merchantId: string;
  // Company info
  legalName: string | null;
  companyType: string | null;
  certificateType: string | null;
  certificateNo: string | null;
  branchName: string | null;
  companyUnit: string | null;
  // Registered address
  addressRegion: string | null;
  addressState: string | null;
  addressCity: string | null;
  address1: string | null;
  address2: string | null;
  zipCode: string | null;
  // Business info
  mcc: string | null;
  doingBusinessAs: string | null;
  websiteUrl: string | null;
  englishName: string | null;
  serviceDescription: string | null;
  appName: string | null;
  merchantBrandName: string | null;
  // Contact
  contactType: string | null;
  contactInfo: string | null;
  // Legal representative
  legalRepName: string | null;
  legalRepIdType: string | null;
  legalRepIdNo: string | null;
  legalRepDob: string | null;
  // Other
  wfKycData: Record<string, unknown> | null;
  rejectedFields: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntityAssociation {
  id: string;
  merchantId: string;
  associationType: string;
  shareholdingRatio: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  idType: string | null;
  idNo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethod {
  id: string;
  merchantId: string;
  paymentMethodType: string;
  status: PaymentMethodStatus;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  merchantId: string;
  notifyId: string;
  notificationType: NotificationType;
  payload: Record<string, unknown>;
  processedAt: string;
  merchant?: { shopName: string };
}

export interface DashboardStats {
  total: number;
  approved: number;
  pending: number;
  offboarded: number;
  recentNotifications: Notification[];
}

export interface MockPresets {
  kycResult: 'APPROVED' | 'REJECTED' | 'SUPPLEMENT_REQUIRED';
  rejectedReason: string;
  rejectedFields: string[];
  paymentMethodStatuses: Record<string, 'ACTIVE' | 'INACTIVE'>;
  riskEnabled: boolean;
  riskLevel: string;
  riskReasonCodes: string[];
}

export interface AppConfig {
  mockMode: boolean;
  antomBaseUrl: string;
  mockNotifyDelayMs: number;
  mockPresets: MockPresets;
}

export interface WsMessage {
  type: 'NOTIFICATION' | 'STATUS_CHANGE';
  data: Record<string, unknown>;
}
