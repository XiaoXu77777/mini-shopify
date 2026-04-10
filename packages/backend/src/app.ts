import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './utils/config';
import { setupWebSocket } from './websocket';
import { errorHandler } from './middleware/errorHandler';
import merchantRouter from './routes/merchant';
import notifyRouter from './routes/notify';
import mockRouter from './routes/mock';
import wfAuthRouter from './routes/wfAuth';

const app = express();

// CORS
app.use(cors());

// JSON body parser with raw body capture for signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  })
);

// Routes
app.use('/api/merchants', merchantRouter);
app.use('/register', notifyRouter);
app.use('/api/mock', mockRouter);
app.use('/api/wf', wfAuthRouter);

// GET /api/config - system configuration for frontend
app.get('/api/config', (_req, res) => {
  res.json({
    mockMode: config.mockMode,
    antomBaseUrl: config.antom.baseUrl,
    mockNotifyDelayMs: config.mockNotifyDelayMs,
    mockPresets: config.mockPresets,
  });
});

// PUT /api/config - update runtime configuration
app.put('/api/config', (req, res) => {
  const { mockMode, mockNotifyDelayMs, mockPresets } = req.body;
  if (typeof mockMode === 'boolean') {
    config.mockMode = mockMode;
    console.log(`[Config] Mock mode switched to: ${mockMode ? 'ON' : 'OFF'}`);
  }
  if (typeof mockNotifyDelayMs === 'number' && mockNotifyDelayMs > 0) {
    config.mockNotifyDelayMs = mockNotifyDelayMs;
  }
  if (mockPresets && typeof mockPresets === 'object') {
    const p = config.mockPresets;
    if (mockPresets.kycResult) p.kycResult = mockPresets.kycResult;
    if (typeof mockPresets.rejectedReason === 'string') p.rejectedReason = mockPresets.rejectedReason;
    if (Array.isArray(mockPresets.rejectedFields)) p.rejectedFields = mockPresets.rejectedFields;
    if (mockPresets.paymentMethodStatuses && typeof mockPresets.paymentMethodStatuses === 'object') {
      p.paymentMethodStatuses = { ...p.paymentMethodStatuses, ...mockPresets.paymentMethodStatuses };
    }
    if (typeof mockPresets.riskEnabled === 'boolean') p.riskEnabled = mockPresets.riskEnabled;
    if (typeof mockPresets.riskLevel === 'string') p.riskLevel = mockPresets.riskLevel;
    if (Array.isArray(mockPresets.riskReasonCodes)) p.riskReasonCodes = mockPresets.riskReasonCodes;
    console.log('[Config] Mock presets updated:', JSON.stringify(p));
  }
  res.json({
    mockMode: config.mockMode,
    antomBaseUrl: config.antom.baseUrl,
    mockNotifyDelayMs: config.mockNotifyDelayMs,
    mockPresets: config.mockPresets,
  });
});

// Error handler
app.use(errorHandler);

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`[Server] Mini-Shopify backend running on http://localhost:${config.port}`);
  console.log(`[Server] Mode: ${config.mockMode ? 'MOCK' : 'PRODUCTION'}`);
  console.log(`[Server] WebSocket: ws://localhost:${config.port}/ws`);
});
