import { useEffect, useRef } from 'react';
import { notification } from 'antd';
import type { WsMessage } from '../types';
import { NOTIFICATION_TYPE_LABELS, PAYMENT_METHOD_OPTIONS } from '../utils/constants';

const PM_TYPE_LABEL_MAP: Record<string, string> = {};
for (const opt of PAYMENT_METHOD_OPTIONS) {
  PM_TYPE_LABEL_MAP[opt.value] = opt.label;
}

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
  const regResult = data.merchantRegistrationResult as Record<string, unknown> | undefined;
  const pmEvent = data.paymentMethodStatusChangeEvent as Record<string, unknown> | undefined;
  const pmDetail = data.paymentMethodDetail as Record<string, unknown> | undefined;
  const riskResult = data.riskScoreResult as Record<string, unknown> | undefined;

  switch (type) {
    case 'REGISTRATION_STATUS': {
      const status = (regResult?.registrationStatus as string) || (data.registrationStatus as string) || 'Unknown';
      return status;
    }
    case 'PAYMENT_METHOD_ACTIVATION_STATUS': {
      const pmType = (pmEvent?.paymentMethodType as string) || (pmDetail?.paymentMethodType as string) || (data.paymentMethodType as string) || 'Unknown';
      const pmLabel = PM_TYPE_LABEL_MAP[pmType] || pmType;
      const rawStatus = (pmEvent?.currentStatus as string) || (pmDetail?.paymentMethodStatus as string) || (data.paymentMethodStatus as string) || '';
      const isActive = rawStatus === 'SUCCESS' || rawStatus === 'ACTIVE';
      const isFail = rawStatus === 'FAIL' || rawStatus === 'INACTIVE';
      return `${pmLabel}: ${isActive ? 'Activated' : isFail ? 'Failed' : 'Processing'}`;
    }
    case 'RISK_NOTIFICATION':
    case 'MERCHANT_RISK_SCORE_NOTIFICATION': {
      const riskLevel = (riskResult?.riskLevel as string) || (data.riskLevel as string) || 'Unknown';
      return `Level: ${riskLevel}`;
    }
    default:
      return type || 'New notification';
  }
}
