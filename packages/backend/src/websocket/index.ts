import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import url from 'url';
import { WsMessage } from '../types';

// Map of merchantId -> Set of connected WebSocket clients
const merchantConnections = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const query = url.parse(req.url || '', true).query;
    const merchantId = query.merchantId as string;

    if (!merchantId) {
      ws.close(1008, 'merchantId query parameter required');
      return;
    }

    // Add to connections map
    if (!merchantConnections.has(merchantId)) {
      merchantConnections.set(merchantId, new Set());
    }
    merchantConnections.get(merchantId)!.add(ws);

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
export function broadcastToMerchant(merchantId: string, message: WsMessage) {
  const connections = merchantConnections.get(merchantId);
  if (!connections || connections.size === 0) return;

  const payload = JSON.stringify(message);
  for (const ws of connections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Broadcast a message to ALL connected clients (for dashboard updates).
 */
export function broadcastToAll(message: WsMessage) {
  const payload = JSON.stringify(message);
  for (const [, connections] of merchantConnections) {
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}
