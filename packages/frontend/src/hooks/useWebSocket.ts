import { useEffect, useRef } from 'react';
import { notification } from 'antd';
import type { WsMessage } from '../types';
import { NOTIFICATION_TYPE_LABELS } from '../utils/constants';

export default function useWebSocket(
  merchantId: string | null,
  onMessage?: (msg: WsMessage) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectDelayRef = useRef(1000);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!merchantId) return;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws?merchantId=${merchantId}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        reconnectDelayRef.current = 1000; // reset backoff
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);

          // Show toast notification
          if (msg.type === 'NOTIFICATION') {
            const notifType = msg.data.notificationType as string;
            notification.info({
              message: NOTIFICATION_TYPE_LABELS[notifType] || notifType,
              description: buildNotificationDescription(msg),
              duration: 5,
              placement: 'topRight',
            });
          }

          // Trigger callback for data refresh
          onMessageRef.current?.(msg);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting...');
        const delay = Math.min(reconnectDelayRef.current, 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current *= 2;
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        ws.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [merchantId]);
}

function buildNotificationDescription(msg: WsMessage): string {
  const data = msg.data;
  const type = data.notificationType as string;

  switch (type) {
    case 'REGISTRATION_STATUS':
      return `Registration status: ${data.registrationStatus || 'Unknown'}`;
    case 'PAYMENT_METHOD_ACTIVATION_STATUS':
      return `${data.paymentMethodType}: ${data.paymentMethodStatus}`;
    case 'RISK_NOTIFICATION':
      return `Risk level: ${data.riskLevel}`;
    default:
      return JSON.stringify(data);
  }
}
