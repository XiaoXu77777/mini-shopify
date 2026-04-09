"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
exports.config = {
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || 'file:./prisma/dev.db',
    antom: {
        clientId: process.env.ANTOM_CLIENT_ID || '',
        privateKey: process.env.ANTOM_PRIVATE_KEY || '',
        publicKey: process.env.ANTOM_PUBLIC_KEY || '',
        baseUrl: process.env.ANTOM_BASE_URL || 'https://open-sea-global.alipay.com',
        agentToken: process.env.ANTOM_AGENT_TOKEN || '',
        parentMerchantId: process.env.PARENT_MERCHANT_ID || '2188120041577055',
        defaultSettlementCurrency: process.env.DEFAULT_SETTLEMENT_CURRENCY || 'HKD',
        sandbox: process.env.ANTOM_SANDBOX !== 'false', // 默认 true，生产环境需显式设为 false
    },
    mockMode: process.env.MOCK_MODE === 'true',
    mockNotifyDelayMs: parseInt(process.env.MOCK_NOTIFY_DELAY_MS || '1500', 10),
    notifyCallbackUrl: process.env.NOTIFY_CALLBACK_URL || '',
    // Mock presets: pre-configured results for mock notifications
    mockPresets: {
        kycResult: 'APPROVED',
        rejectedReason: '',
        rejectedFields: [],
        paymentMethodStatuses: {},
        riskEnabled: false,
        riskLevel: 'LOW',
        riskReasonCodes: [],
    },
};
//# sourceMappingURL=config.js.map