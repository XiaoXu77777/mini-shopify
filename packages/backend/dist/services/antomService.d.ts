import type { AntomResponse } from '../types';
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
export declare const antomService: {
    /**
     * Register a merchant with Antom (guide section 4.1).
     * Builds nested merchant object from flat DB data.
     */
    register(data: RegisterData): Promise<AntomResponse>;
    /**
     * Query registration or offboarding status (guide section 4.2).
     */
    inquireRegistrationStatus(data: {
        registrationRequestId?: string;
        offboardingRequestId?: string;
        referenceMerchantId: string;
    }): Promise<AntomResponse>;
    /**
     * Offboard a merchant (guide section 4.4).
     * Uses separate offboardingRequestId.
     */
    offboard(data: {
        offboardingRequestId: string;
        referenceMerchantId: string;
    }): Promise<AntomResponse>;
    /**
     * Deactivate a payment method.
     */
    deactivate(registrationRequestId: string, paymentMethodType: string): Promise<AntomResponse>;
    /**
     * Query KYB information from Antom using WF access token.
     * This is used after user logs in with WorldFirst and authorizes to share KYB info.
     */
    queryKybInfo(accessToken: string, customerId: string): Promise<{
        success: boolean;
        kybData?: Record<string, unknown>;
        error?: string;
    }>;
};
export {};
//# sourceMappingURL=antomService.d.ts.map