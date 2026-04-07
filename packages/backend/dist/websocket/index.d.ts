import { Server } from 'http';
import { WsMessage } from '../types';
export declare function setupWebSocket(server: Server): void;
/**
 * Broadcast a message to all connected clients for a specific merchant.
 */
export declare function broadcastToMerchant(merchantId: string, message: WsMessage): void;
/**
 * Broadcast a message to ALL connected clients (for dashboard updates).
 */
export declare function broadcastToAll(message: WsMessage): void;
//# sourceMappingURL=index.d.ts.map