export type MerchantStatus = 'ACTIVE' | 'INACTIVE' | 'OFFBOARDED';
export type KycStatus = 'INIT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPPLEMENT_REQUIRED';
export type PaymentMethodStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE';
export type NotificationType = 'REGISTRATION_STATUS' | 'PAYMENT_METHOD_ACTIVATION_STATUS' | 'RISK_NOTIFICATION';
export interface AntomResultInfo {
    resultCode: string;
    resultCodeId?: string;
    resultMessage?: string;
    resultStatus: 'S' | 'U' | 'F';
}
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
    name: {
        firstName?: string;
        lastName?: string;
        fullName?: string;
    };
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
            websites?: {
                type: string;
                url: string;
            }[];
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
        settlementAccountInfo?: {
            accountNo: string;
        };
    }[];
    paymentMethodActivationRequests: {
        paymentMethodType: string;
        productCodes: string[];
    }[];
}
export interface AntomInquireRequest {
    registrationRequestId?: string;
    offboardingRequestId?: string;
    merchant: {
        integrationPartnerId: string;
        referenceMerchantId: string;
    };
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
export interface AntomOffboardRequest {
    offboardingRequestId: string;
    merchant?: {
        parentMerchantId: string;
        referenceMerchantId: string;
    };
}
export interface AntomNotification {
    notifyId: string;
    notificationType: string;
    notifyType?: string;
    registrationRequestId?: string;
    merchantRegistrationResult?: {
        registrationStatus: string;
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
    paymentMethodType?: string;
    paymentMethodStatus?: string;
    riskLevel?: string;
    riskReasonCodes?: string[];
    registrationStatus?: string;
    kycStatus?: string;
    rejectedFields?: string[];
    rejectedReason?: string;
    [key: string]: unknown;
}
export interface WsMessage {
    type: 'NOTIFICATION' | 'STATUS_CHANGE';
    data: Record<string, unknown>;
}
export interface MockNotifyRequest {
    merchantId: string;
    notificationType: NotificationType;
    data: Record<string, unknown>;
}
//# sourceMappingURL=index.d.ts.map