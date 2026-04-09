import { Descriptions, Timeline, Typography, Tag, Card, Spin } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined,
  WarningOutlined,
  PoweroffOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { Merchant, Notification } from '../../../types';
import type { RegistrationStatusResult } from '../index';

const { Text } = Typography;

interface Props {
  merchant: Merchant;
  notifications: Notification[];
  registrationStatus: RegistrationStatusResult | null;
  registrationStatusLoading: boolean;
}

export default function OverviewTab({ merchant, notifications, registrationStatus, registrationStatusLoading }: Props) {
  const timelineItems = buildTimeline(merchant, notifications);

  // Map registration status to display info
  const getRegistrationStatusDisplay = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return { color: 'success' as const, icon: <CheckCircleOutlined />, label: 'Approved' };
      case 'FAIL':
        return { color: 'error' as const, icon: <CloseCircleOutlined />, label: 'Failed' };
      case 'PROCESSING':
        return { color: 'processing' as const, icon: <SyncOutlined spin />, label: 'Processing' };
      case 'SUPPLEMENT_REQUIRED':
        return { color: 'warning' as const, icon: <ExclamationCircleOutlined />, label: 'Supplement Required' };
      default:
        return { color: 'default' as const, icon: <ClockCircleOutlined />, label: status };
    }
  };

  return (
    <div style={{ display: 'flex', gap: 32, flexDirection: 'column' }}>
      {/* Registration Status Card - shown when merchant has been registered */}
      {merchant.registrationRequestId && (
        <Card
          title="Registration Status (inquiryRegistrationStatus)"
          size="small"
          style={{ marginBottom: 0 }}
          extra={registrationStatusLoading ? <Spin size="small" /> : null}
        >
          {registrationStatusLoading && !registrationStatus ? (
            <Spin size="small" />
          ) : registrationStatus ? (
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Registration Status">
                <Tag
                  icon={getRegistrationStatusDisplay(registrationStatus.registrationStatus).icon}
                  color={getRegistrationStatusDisplay(registrationStatus.registrationStatus).color}
                >
                  {getRegistrationStatusDisplay(registrationStatus.registrationStatus).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Registration Request ID">
                <Text copyable style={{ fontSize: 12 }}>
                  {registrationStatus.registrationRequestId || merchant.registrationRequestId}
                </Text>
              </Descriptions.Item>
              {registrationStatus.referenceMerchantId && (
                <Descriptions.Item label="Reference Merchant ID">
                  <Text copyable style={{ fontSize: 12 }}>{registrationStatus.referenceMerchantId}</Text>
                </Descriptions.Item>
              )}
              {registrationStatus.parentMerchantId && (
                <Descriptions.Item label="Parent Merchant ID">
                  <Text copyable style={{ fontSize: 12 }}>{registrationStatus.parentMerchantId}</Text>
                </Descriptions.Item>
              )}
              {registrationStatus.failReasonType && (
                <Descriptions.Item label="Fail Reason Type" span={2}>
                  <Text type="danger">{registrationStatus.failReasonType}</Text>
                </Descriptions.Item>
              )}
              {registrationStatus.failReasonDescription && (
                <Descriptions.Item label="Fail Reason Description" span={2}>
                  <Text type="danger">{registrationStatus.failReasonDescription}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          ) : (
            <Text type="secondary">No registration status available</Text>
          )}
        </Card>
      )}

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
        const pmType = payload.paymentMethodType as string || 'Unknown';
        const pmStatus = payload.paymentMethodStatus as string || '';
        const isActive = pmStatus === 'ACTIVE';
        items.push({
          color: isActive ? 'green' : 'red',
          dot: <CreditCardOutlined />,
          children: (
            <div>
              <Text strong>{pmType} {isActive ? 'Activated' : 'Deactivated'}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>{time}</Text>
            </div>
          ),
        });
        break;
      }

      case 'RISK_NOTIFICATION': {
        const riskLevel = payload.riskLevel as string || 'UNKNOWN';
        const riskCodes = payload.riskReasonCodes as string[] | undefined;
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
