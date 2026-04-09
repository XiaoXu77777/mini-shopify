export declare const config: {
    port: number;
    databaseUrl: string;
    antom: {
        clientId: string;
        privateKey: string;
        publicKey: string;
        baseUrl: string;
        agentToken: string;
        parentMerchantId: string;
        defaultSettlementCurrency: string;
        sandbox: boolean;
    };
    mockMode: boolean;
    mockNotifyDelayMs: number;
    notifyCallbackUrl: string;
    mockPresets: {
        kycResult: "APPROVED" | "REJECTED" | "SUPPLEMENT_REQUIRED";
        rejectedReason: string;
        rejectedFields: string[];
        paymentMethodStatuses: Record<string, "ACTIVE" | "INACTIVE">;
        riskEnabled: boolean;
        riskLevel: string;
        riskReasonCodes: string[];
    };
};
//# sourceMappingURL=config.d.ts.map