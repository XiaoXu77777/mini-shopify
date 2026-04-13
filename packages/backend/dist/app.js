"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const config_1 = require("./utils/config");
const websocket_1 = require("./websocket");
const errorHandler_1 = require("./middleware/errorHandler");
const merchant_1 = __importDefault(require("./routes/merchant"));
const notify_1 = __importDefault(require("./routes/notify"));
const mock_1 = __importDefault(require("./routes/mock"));
const wfAuth_1 = __importDefault(require("./routes/wfAuth"));
const app = (0, express_1.default)();
// CORS
app.use((0, cors_1.default)());
// JSON body parser with raw body capture for signature verification
app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
    },
}));
// Global request logger - log every incoming request
app.use((req, _res, next) => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} from ${req.ip} | Content-Type: ${req.headers['content-type'] || '(none)'}`);
    next();
});
// Routes
app.use('/api/merchants', merchant_1.default);
app.use('/api/notify', notify_1.default);
app.use('/api/mock', mock_1.default);
app.use('/api/wf', wfAuth_1.default);
// GET /api/config - system configuration for frontend
app.get('/api/config', (_req, res) => {
    res.json({
        mockMode: config_1.config.mockMode,
        antomBaseUrl: config_1.config.antom.baseUrl,
        mockNotifyDelayMs: config_1.config.mockNotifyDelayMs,
        mockPresets: config_1.config.mockPresets,
    });
});
// PUT /api/config - update runtime configuration
app.put('/api/config', (req, res) => {
    const { mockMode, mockNotifyDelayMs, mockPresets } = req.body;
    if (typeof mockMode === 'boolean') {
        config_1.config.mockMode = mockMode;
        console.log(`[Config] Mock mode switched to: ${mockMode ? 'ON' : 'OFF'}`);
    }
    if (typeof mockNotifyDelayMs === 'number' && mockNotifyDelayMs > 0) {
        config_1.config.mockNotifyDelayMs = mockNotifyDelayMs;
    }
    if (mockPresets && typeof mockPresets === 'object') {
        const p = config_1.config.mockPresets;
        if (mockPresets.kycResult)
            p.kycResult = mockPresets.kycResult;
        if (typeof mockPresets.rejectedReason === 'string')
            p.rejectedReason = mockPresets.rejectedReason;
        if (Array.isArray(mockPresets.rejectedFields))
            p.rejectedFields = mockPresets.rejectedFields;
        if (mockPresets.paymentMethodStatuses && typeof mockPresets.paymentMethodStatuses === 'object') {
            p.paymentMethodStatuses = { ...p.paymentMethodStatuses, ...mockPresets.paymentMethodStatuses };
        }
        if (typeof mockPresets.riskEnabled === 'boolean')
            p.riskEnabled = mockPresets.riskEnabled;
        if (typeof mockPresets.riskLevel === 'string')
            p.riskLevel = mockPresets.riskLevel;
        if (Array.isArray(mockPresets.riskReasonCodes))
            p.riskReasonCodes = mockPresets.riskReasonCodes;
        console.log('[Config] Mock presets updated:', JSON.stringify(p));
    }
    res.json({
        mockMode: config_1.config.mockMode,
        antomBaseUrl: config_1.config.antom.baseUrl,
        mockNotifyDelayMs: config_1.config.mockNotifyDelayMs,
        mockPresets: config_1.config.mockPresets,
    });
});
// Error handler
app.use(errorHandler_1.errorHandler);
// Create HTTP server (for local dev / internal access)
const httpServer = http_1.default.createServer(app);
(0, websocket_1.setupWebSocket)(httpServer);
httpServer.listen(config_1.config.port, () => {
    console.log(`[Server] HTTP server running on http://localhost:${config_1.config.port}`);
    console.log(`[Server] Mode: ${config_1.config.mockMode ? 'MOCK' : 'PRODUCTION'}`);
    console.log(`[Server] WebSocket: ws://localhost:${config_1.config.port}/ws`);
    console.log(`[Server] Antom callback: https://minishopify.xyz/api/notify/register (via Nginx reverse proxy)`);
});
//# sourceMappingURL=app.js.map