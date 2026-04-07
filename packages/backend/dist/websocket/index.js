"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
exports.broadcastToMerchant = broadcastToMerchant;
exports.broadcastToAll = broadcastToAll;
const ws_1 = require("ws");
const url_1 = __importDefault(require("url"));
// Map of merchantId -> Set of connected WebSocket clients
const merchantConnections = new Map();
function setupWebSocket(server) {
    const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws, req) => {
        const query = url_1.default.parse(req.url || '', true).query;
        const merchantId = query.merchantId;
        if (!merchantId) {
            ws.close(1008, 'merchantId query parameter required');
            return;
        }
        // Add to connections map
        if (!merchantConnections.has(merchantId)) {
            merchantConnections.set(merchantId, new Set());
        }
        merchantConnections.get(merchantId).add(ws);
        console.log(`[WS] Client connected for merchant ${merchantId}`);
        ws.on('close', () => {
            const connections = merchantConnections.get(merchantId);
            if (connections) {
                connections.delete(ws);
                if (connections.size === 0) {
                    merchantConnections.delete(merchantId);
                }
            }
            console.log(`[WS] Client disconnected for merchant ${merchantId}`);
        });
        ws.on('error', (err) => {
            console.error(`[WS] Error for merchant ${merchantId}:`, err.message);
        });
    });
    console.log('[WS] WebSocket server initialized on /ws');
}
/**
 * Broadcast a message to all connected clients for a specific merchant.
 */
function broadcastToMerchant(merchantId, message) {
    const connections = merchantConnections.get(merchantId);
    if (!connections || connections.size === 0)
        return;
    const payload = JSON.stringify(message);
    for (const ws of connections) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(payload);
        }
    }
}
/**
 * Broadcast a message to ALL connected clients (for dashboard updates).
 */
function broadcastToAll(message) {
    const payload = JSON.stringify(message);
    for (const [, connections] of merchantConnections) {
        for (const ws of connections) {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(payload);
            }
        }
    }
}
//# sourceMappingURL=index.js.map