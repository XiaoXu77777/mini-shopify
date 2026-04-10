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
    parentMerchantId: process.env.PARENT_MERCHANT_ID,
    defaultSettlementCurrency: process.env.DEFAULT_SETTLEMENT_CURRENCY || 'HKD',
    sandbox: process.env.ANTOM_SANDBOX !== 'false', // 默认 true，生产环境需显式设为 false
  },

  // Temporary workaround: KYB fileUrl cannot be used directly in register requests.
  // When enabled, all fileUrl values in register requests will be replaced with the proxy URL.
  useProxyFileUrl: process.env.USE_PROXY_FILE_URL !== 'false', // default true
  proxyFileUrl: process.env.PROXY_FILE_URL || 'https://pics1.baidu.com/feed/a5c27d1ed21b0ef4d0d3794da512ecd780cb3eca.jpeg',
  proxyFileName: process.env.PROXY_FILE_NAME || '1745219612128_fish.jpeg',

  mockMode: process.env.MOCK_MODE === 'true',
  mockNotifyDelayMs: parseInt(process.env.MOCK_NOTIFY_DELAY_MS || '1500', 10),
  notifyCallbackUrl: process.env.NOTIFY_CALLBACK_URL || '',
  frontendUrl: process.env.FRONTEND_URL || 'https://minishopify.xyz',

  wf: {
    oauthClientID:'5J5YHR5W2YBU9403103',
    oauthClientId:  '2188120272582435',
    oauthClientSecret: '',
    privateKey: process.env.WF_PRIVATE_KEY || '',
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
