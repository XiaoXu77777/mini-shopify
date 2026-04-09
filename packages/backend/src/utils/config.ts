import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
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
  frontendUrl: process.env.FRONTEND_URL || 'https://minishopify.xyz',

  wf: {
    oauthClientId: process.env.WF_OAUTH_CLIENT_ID || '2188120328356641',
    oauthClientSecret: process.env.WF_OAUTH_CLIENT_SECRET || '',
  },

  // Mock presets: pre-configured results for mock notifications
  mockPresets: {
    kycResult: 'APPROVED' as 'APPROVED' | 'REJECTED' | 'SUPPLEMENT_REQUIRED',
    rejectedReason: '',
    rejectedFields: [] as string[],
    paymentMethodStatuses: {} as Record<string, 'ACTIVE' | 'INACTIVE'>,
    riskEnabled: false,
    riskLevel: 'LOW' as string,
    riskReasonCodes: [] as string[],
  },
};
