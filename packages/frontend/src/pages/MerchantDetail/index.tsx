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
import { useAppContext } from '../../context/AppContext';
import type { Merchant, Notification } from '../../types';

const { Title } = Typography;

export default function MerchantDetail() {
  const { id: paramId } = useParams<{ id: string }>();
  const { currentMerchant } = useAppContext();
  const merchantId = paramId || currentMerchant?.id;
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Query registration status from Antom (guide section 4.2)
  // This is a silent sync to compensate for missed notifications.
  // It updates local merchant status based on Antom response, then refreshes merchant data.
  const fetchRegistrationStatus = useCallback(async (mid: string) => {
    try {
      const res = await merchantApi.inquireRegistrationStatus(mid);
      // Backend has updated merchant status via updateStatusFromRegistrationResult
      if (res.data.merchant) {
        const freshRes = await merchantApi.getById(mid);
        setMerchant(freshRes.data);
      }
    } catch (err) {
      console.error('Failed to query registration status:', err);
    }
  }, []);

  const fetchMerchant = useCallback(async () => {
    if (!merchantId) return;
    try {
      const [merchantRes, notifyRes] = await Promise.all([
        merchantApi.getById(merchantId),
        merchantApi.getNotifications(merchantId),
      ]);
      setMerchant(merchantRes.data);
      setNotifications(notifyRes.data.data);
    } catch (err) {
      console.error('Failed to fetch merchant:', err);
      message.error('Failed to load merchant details');
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  // On page load: fetch merchant data, then query registration status once
  const initialLoadDone = useRef(false);
  // 当 merchantId 变化时，重置加载状态，确保切换商户后能重新获取数据
  useEffect(() => {
    initialLoadDone.current = false;
    setMerchant(null);
    setNotifications([]);
    setLoading(true);
  }, [merchantId]);
  useEffect(() => {
    if (!merchantId || initialLoadDone.current) return;
    initialLoadDone.current = true;
    (async () => {
      await fetchMerchant();
    })();
  }, [merchantId, fetchMerchant]);

  // After initial merchant data is loaded, query registration status once
  // Skip if kycStatus is still PENDING (just submitted, Antom hasn't processed yet)
  useEffect(() => {
    if (!merchant || !merchantId) return;
    if (merchant.registrationRequestId && merchant.kycStatus !== 'PENDING') {
      fetchRegistrationStatus(merchantId);
    }
    // Only run once after merchant is first loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.registrationRequestId]);

  // WebSocket: auto-refresh on notifications (debounced, last one wins)
  useWebSocket(merchantId || null, () => {
    clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      fetchMerchant();
    }, 300);
  });

  useEffect(() => {
    return () => clearTimeout(fetchTimerRef.current);
  }, []);

  const handleOffboard = async () => {
    if (!merchantId) return;
    try {
      await merchantApi.offboard(merchantId);
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

  if (!merchantId) {
    return <Alert message="No merchant selected. Please select a store from the dropdown above." type="info" showIcon />;
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
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ padding: 0, marginBottom: 8 }}>
        Back to Home
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
