import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Spin, Button, Popconfirm, message, Typography, Space, Tag, Alert } from 'antd';
import { ArrowLeftOutlined, StopOutlined } from '@ant-design/icons';
import { merchantApi } from '../../services/merchantApi';
import { KycStatusTag, MerchantStatusTag } from '../../components/StatusTags';
import OverviewTab from './tabs/Overview';
import KycTab from './tabs/KycTab';
import PaymentMethodsTab from './tabs/PaymentMethods';
import NotificationsTab from './tabs/Notifications';
import useWebSocket from '../../hooks/useWebSocket';
import type { Merchant, Notification } from '../../types';

const { Title } = Typography;

export default function MerchantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchMerchant = useCallback(async () => {
    if (!id) return;
    try {
      const [merchantRes, notifyRes] = await Promise.all([
        merchantApi.getById(id),
        merchantApi.getNotifications(id),
      ]);
      setMerchant(merchantRes.data);
      setNotifications(notifyRes.data.data);
    } catch (err) {
      console.error('Failed to fetch merchant:', err);
      message.error('Failed to load merchant details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMerchant();
  }, [fetchMerchant]);

  // WebSocket: auto-refresh on notifications (debounced, last one wins)
  useWebSocket(id || null, () => {
    clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      fetchMerchant();
    }, 300);
  });

  useEffect(() => {
    return () => clearTimeout(fetchTimerRef.current);
  }, []);

  const handleOffboard = async () => {
    if (!id) return;
    try {
      await merchantApi.offboard(id);
      message.success('Merchant offboarded successfully');
      fetchMerchant();
    } catch (err) {
      console.error('Offboard error:', err);
      message.error('Failed to offboard merchant');
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', marginTop: 100, textAlign: 'center' }} />;
  }

  if (!merchant) {
    return <Alert message="Merchant not found" type="error" />;
  }

  const isOffboarded = merchant.status === 'OFFBOARDED';

  const tabItems = [
    { key: 'overview', label: 'Overview', children: <OverviewTab merchant={merchant} notifications={notifications} /> },
    { key: 'kyc', label: 'KYC', children: <KycTab merchant={merchant} onRefresh={fetchMerchant} /> },
    { key: 'payment-methods', label: 'Payment Methods', children: <PaymentMethodsTab merchant={merchant} onRefresh={fetchMerchant} /> },
    { key: 'notifications', label: 'Notifications', children: <NotificationsTab merchantId={merchant.id} /> },
  ];

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/merchants')} style={{ padding: 0, marginBottom: 8 }}>
        Back to Merchants
      </Button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space size="middle">
          <Title level={3} style={{ margin: 0 }}>{merchant.shopName}</Title>
          <KycStatusTag status={merchant.kycStatus} />
          <MerchantStatusTag status={merchant.status} />
          {merchant.riskLevel && (
            <Tag color={merchant.riskLevel === 'HIGH' ? 'red' : merchant.riskLevel === 'MEDIUM' ? 'orange' : 'green'}>
              Risk: {merchant.riskLevel}
            </Tag>
          )}
        </Space>
        {!isOffboarded && (
          <Popconfirm
            title="Offboard this merchant?"
            description="This action is irreversible. The merchant will be permanently closed."
            onConfirm={handleOffboard}
            okText="Yes, Offboard"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<StopOutlined />}>
              Close Shop
            </Button>
          </Popconfirm>
        )}
      </div>

      {isOffboarded && (
        <Alert message="This merchant has been offboarded" type="warning" showIcon style={{ marginBottom: 16 }} />
      )}

      <Tabs defaultActiveKey="overview" items={tabItems} />
    </div>
  );
}
