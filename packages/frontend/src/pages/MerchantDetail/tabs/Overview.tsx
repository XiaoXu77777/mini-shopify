import { Descriptions, Timeline, Typography, Tag } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined,
  WarningOutlined,
  PoweroffOutlined,
} from '@ant-design/icons';
import type { Merchant, Notification } from '../../../types';
import { PAYMENT_METHOD_OPTIONS } from '../../../utils/constants';

const { Text } = Typography;

// Build a lookup map for payment method type labels
const PM_TYPE_LABEL_MAP: Record<string, string> = {};
for (const opt of PAYMENT_METHOD_OPTIONS) {
  PM_TYPE_LABEL_MAP[opt.value] = opt.label;
}

interface Props {
  merchant: Merchant;
  notifications: Notification[];
}

export default function OverviewTab({ merchant, notifications }: Props) {
  const timelineItems = buildTimeline(merchant, notifications);

  return (
    <div style={{ display: 'flex', gap: 32, flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 32 }}>
        <div style={{ flex: 1 }}>
        <Descriptions title="Merchant Information" bordered column={1} size="small">
          <Descriptions.Item label="Shop Name">{merchant.shopName}</Descriptions.Item>
          <Descriptions.Item label="Email">{merchant.email}</Descriptions.Item>
          <Descriptions.Item label="Region">{merchant.region}</Descriptions.Item>
          <Descriptions.Item label="WF Account ID">
            {merchant.wfAccountId || <Text type="secondary">Not connected</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Registration Request ID">
            {merchant.registrationRequestId || <Text type="secondary">Not registered</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Antom Merchant ID">
            {merchant.antomMerchantId || <Text type="secondary">Not assigned</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(merchant.createdAt).toLocaleString()}
          </Descriptions.Item>
          {merchant.riskLevel && (
            <Descriptions.Item label="Risk Level">
              <Tag color={merchant.riskLevel === 'HIGH' ? 'red' : merchant.riskLevel === 'MEDIUM' ? 'orange' : 'green'}>
                {merchant.riskLevel}
              </Tag>
            </Descriptions.Item>
          )}
          {merchant.riskReasonCodes && merchant.riskReasonCodes.length > 0 && (
            <Descriptions.Item label="Risk Reason Codes">
              {merchant.riskReasonCodes.map((code) => (
                <Tag key={code} color="red">{code}</Tag>
              ))}
            </Descriptions.Item>
          )}
        </Descriptions>
        </div>
        <div style={{ width: 360 }}>
          <Typography.Title level={5}>Status Timeline</Typography.Title>
          <Timeline items={timelineItems} />
        </div>
      </div>
    </div>
  );
}

/**
 * Map Antom registrationStatus in notification payload to readable KYC label.
 */
function getKycLabel(payload: Record<string, unknown>): { label: string; color: string; icon: React.ReactNode } {
  // Check nested merchantRegistrationResult first (guide format)
  const regResult = payload.merchantRegistrationResult as Record<string, unknown> | undefined;
  const status = regResult?.registrationStatus as string
    || payload.registrationStatus as string
    || '';

  switch (status) {
    case 'SUCCESS':
      return { label: 'KYC Approved', color: 'green', icon: <CheckCircleOutlined /> };
    case 'FAIL':
      return { label: 'KYC Rejected', color: 'red', icon: <CloseCircleOutlined /> };
    case 'SUPPLEMENT_REQUIRED':
      return { label: 'KYC Supplement Required', color: 'orange', icon: <ExclamationCircleOutlined /> };
    case 'PROCESSING':
      return { label: 'KYC Under Review', color: 'blue', icon: <ClockCircleOutlined /> };
    default:
      return { label: `KYC Status: ${status}`, color: 'gray', icon: <SafetyCertificateOutlined /> };
  }
}

/**
 * Check if notification is an offboarding result (vs registration).
 */
function isOffboardNotification(payload: Record<string, unknown>): boolean {
  return !!(payload.merchantOffboardingResult);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function buildTimeline(merchant: Merchant, notifications: Notification[]) {
  const items: { color: string; dot?: React.ReactNode; children: React.ReactNode }[] = [];

  // 1. Merchant Created (always first)
  items.push({
    color: 'green',
    dot: <CheckCircleOutlined />,
    children: (
      <div>
        <Text strong>Merchant Created</Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(merchant.createdAt)}</Text>
      </div>
    ),
  });

  // 2. WF Account Connected (if present, use merchant.updatedAt as approximate time)
  if (merchant.wfAccountId) {
    items.push({
      color: 'green',
      dot: <CheckCircleOutlined />,
      children: (
        <div>
          <Text strong>WF Account Connected</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{merchant.wfAccountId}</Text>
        </div>
      ),
    });
  }

  // 3. Build timeline from notification history (sorted by processedAt ascending)
  const sorted = [...notifications].sort(
    (a, b) => new Date(a.processedAt).getTime() - new Date(b.processedAt).getTime()
  );

  for (const notif of sorted) {
    const payload = notif.payload || {};
    const time = formatTime(notif.processedAt);

    switch (notif.notificationType) {
      case 'REGISTRATION_STATUS': {
        if (isOffboardNotification(payload)) {
          // Offboard notification
          items.push({
            color: 'gray',
            dot: <PoweroffOutlined />,
            children: (
              <div>
                <Text strong>Merchant Offboarded</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>{time}</Text>
              </div>
            ),
          });
        } else {
          // KYC / Registration status notification
          const { label, color, icon } = getKycLabel(payload);

          // Extract extra info for rejected/supplement
          const rejectedReason = payload.rejectedReason as string | undefined;
          const rejectedFields = payload.rejectedFields as string[] | undefined;
          const regResult = payload.merchantRegistrationResult as Record<string, unknown> | undefined;
          const failReason = regResult?.failReasonDescription as string | undefined;

          items.push({
            color,
            dot: icon,
            children: (
              <div>
                <Text strong>{label}</Text>
                {(failReason || rejectedReason) && (
                  <>
                    <br />
                    <Text type="danger" style={{ fontSize: 12 }}>{failReason || rejectedReason}</Text>
                  </>
                )}
                {rejectedFields && rejectedFields.length > 0 && (
                  <>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Fields: {rejectedFields.join(', ')}
                    </Text>
                  </>
                )}
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>{time}</Text>
              </div>
            ),
          });
        }
        break;
      }

      case 'PAYMENT_METHOD_ACTIVATION_STATUS': {
        // Extract from nested paymentMethodStatusChangeEvent (actual Antom format) or flat fields (legacy)
        const pmEvent = payload.paymentMethodStatusChangeEvent as Record<string, unknown> | undefined;
        const pmTypeCode = (pmEvent?.paymentMethodType as string)
          || (payload.paymentMethodDetail as Record<string, unknown> | undefined)?.paymentMethodType as string
          || payload.paymentMethodType as string
          || 'Unknown';
        const pmTypeLabel = PM_TYPE_LABEL_MAP[pmTypeCode] || pmTypeCode;

        const rawStatus = (pmEvent?.currentStatus as string)
          || (payload.paymentMethodDetail as Record<string, unknown> | undefined)?.paymentMethodStatus as string
          || payload.paymentMethodStatus as string
          || '';
        // Map Antom status to display status
        const isActive = rawStatus === 'SUCCESS' || rawStatus === 'ACTIVE';
        const isFail = rawStatus === 'FAIL' || rawStatus === 'INACTIVE';
        const failReason = pmEvent?.failReason as string | undefined;

        items.push({
          color: isActive ? 'green' : isFail ? 'red' : 'blue',
          dot: <CreditCardOutlined />,
          children: (
            <div>
              <Text strong>{pmTypeLabel} {isActive ? 'Activated' : isFail ? 'Failed' : 'Processing'}</Text>
              {failReason && (
                <>
                  <br />
                  <Text type="danger" style={{ fontSize: 12 }}>{failReason}</Text>
                </>
              )}
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>{time}</Text>
            </div>
          ),
        });
        break;
      }

      case 'RISK_NOTIFICATION':
      case 'MERCHANT_RISK_SCORE_NOTIFICATION': {
        const riskResult = payload.riskScoreResult as Record<string, unknown> | undefined;
        const riskLevel = (riskResult?.riskLevel as string) || payload.riskLevel as string || 'UNKNOWN';
        const riskCodes = (riskResult?.reasonCodes as string[]) || payload.riskReasonCodes as string[] | undefined;
        items.push({
          color: riskLevel === 'HIGH' ? 'red' : riskLevel === 'MEDIUM' ? 'orange' : 'blue',
          dot: <WarningOutlined />,
          children: (
            <div>
              <Text strong>Risk Alert: {riskLevel}</Text>
              {riskCodes && riskCodes.length > 0 && (
                <>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>Codes: {riskCodes.join(', ')}</Text>
                </>
              )}
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>{time}</Text>
            </div>
          ),
        });
        break;
      }
    }
  }

  // If no notifications yet but registration was submitted, show pending
  if (merchant.registrationRequestId && notifications.length === 0) {
    items.push({
      color: 'blue',
      dot: <ClockCircleOutlined />,
      children: (
        <div>
          <Text strong>Registration Submitted - Pending Review</Text>
        </div>
      ),
    });
  }

  return items;
}
