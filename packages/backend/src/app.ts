import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
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

// Global request logger - log every incoming request
app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl} from ${req.ip} | Content-Type: ${req.headers['content-type'] || '(none)'}`);
  next();
});

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

// Create HTTP server (for local dev / internal access)
const httpServer = http.createServer(app);
setupWebSocket(httpServer);

httpServer.listen(config.port, () => {
  console.log(`[Server] HTTP server running on http://localhost:${config.port}`);
  console.log(`[Server] Mode: ${config.mockMode ? 'MOCK' : 'PRODUCTION'}`);
  console.log(`[Server] WebSocket: ws://localhost:${config.port}/ws`);
});

// Create HTTPS server (for Antom callbacks and public access)
// Support both tsx (src/) and compiled (dist/) directory structures
const cfgDir = path.resolve(__dirname, '../../cfg');
const cfgDirAlt = path.resolve(__dirname, '../cfg');
const sslDir = fs.existsSync(cfgDir) ? cfgDir : cfgDirAlt;
const sslKeyPath = path.join(sslDir, 'minishopify.xyz.key');
const sslCertPath = path.join(sslDir, 'minishopify.xyz.pem');

if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const sslOptions = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  };
  const httpsServer = https.createServer(sslOptions, app);
  setupWebSocket(httpsServer);

  httpsServer.listen(443, () => {
    console.log(`[Server] HTTPS server running on https://minishopify.xyz:443`);
    console.log(`[Server] WebSocket: wss://minishopify.xyz/ws`);
  });
} else {
  console.warn(`[Server] SSL certificates not found at ${sslKeyPath}, HTTPS server not started`);
  console.warn(`[Server] Antom callbacks (https://minishopify.xyz/register/notification) will NOT work`);
}
