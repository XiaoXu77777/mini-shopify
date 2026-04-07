import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Typography } from 'antd';
import { ShopOutlined, CheckCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons';
import { merchantApi } from '../services/merchantApi';
import { useAppContext } from '../context/AppContext';
import type { DashboardStats, Notification } from '../types';
import { NOTIFICATION_TYPE_LABELS } from '../utils/constants';

const { Title } = Typography;

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentMerchant } = useAppContext();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await merchantApi.getStats(currentMerchant?.id || undefined);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentMerchant?.id]);

  const notificationColumns = [
    {
      title: 'Time',
      dataIndex: 'processedAt',
      key: 'processedAt',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: 'Type',
      dataIndex: 'notificationType',
      key: 'notificationType',
      width: 220,
      render: (val: string) => NOTIFICATION_TYPE_LABELS[val] || val,
    },
    {
      title: 'Merchant',
      dataIndex: ['merchant', 'shopName'],
      key: 'shopName',
    },
    {
      title: 'Notify ID',
      dataIndex: 'notifyId',
      key: 'notifyId',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          Dashboard{currentMerchant ? ` - ${currentMerchant.shopName}` : ''}
        </Title>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Merchants" value={stats?.total ?? '-'} prefix={<ShopOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="KYC Approved" value={stats?.approved ?? '-'} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} loading={loading} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="KYC Pending" value={stats?.pending ?? '-'} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1890ff' }} loading={loading} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Offboarded" value={stats?.offboarded ?? '-'} prefix={<StopOutlined />} loading={loading} />
          </Card>
        </Col>
      </Row>

      <Card title="Recent Notifications">
        <Table<Notification>
          dataSource={stats?.recentNotifications || []}
          columns={notificationColumns}
          rowKey="id"
          pagination={false}
          size="small"
          loading={loading}
          locale={{ emptyText: 'No notifications yet' }}
        />
      </Card>
    </div>
  );
}
