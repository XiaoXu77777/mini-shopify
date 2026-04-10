export declare const config: {
    port: number;
    databaseUrl: string;
    antom: {
        clientId: string;
        privateKey: string;
        publicKey: string;
        baseUrl: string;
        agentToken: string;
        parentMerchantId: string | undefined;
        defaultSettlementCurrency: string;
        sandbox: boolean;
    };
    useProxyFileUrl: boolean;
    proxyFileUrl: string;
    proxyFileName: string;
    mockMode: boolean;
    mockNotifyDelayMs: number;
    notifyCallbackUrl: string;
    frontendUrl: string;
    wf: {
        oauthClientID: string;
        oauthClientId: string;
        oauthClientSecret: string;
        privateKey: string;
    };
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