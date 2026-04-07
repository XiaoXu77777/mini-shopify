import { useEffect, useState } from 'react';
import { Table, Typography, Button } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantApi } from '../services/merchantApi';
import { useAppContext } from '../context/AppContext';
import { KycStatusTag, MerchantStatusTag } from '../components/StatusTags';
import type { Merchant } from '../types';

const { Title } = Typography;

export default function MerchantList() {
  const [allMerchants, setAllMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { currentMerchant } = useAppContext();

  useEffect(() => {
    merchantApi
      .list()
      .then((res) => setAllMerchants(res.data.data))
      .catch((err) => console.error('Failed to load merchants:', err))
      .finally(() => setLoading(false));
  }, []);

  // Filter by selected store
  const merchants = currentMerchant
    ? allMerchants.filter((m) => m.id === currentMerchant.id)
    : allMerchants;

  const columns = [
    {
      title: 'Shop Name',
      dataIndex: 'shopName',
      key: 'shopName',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      width: 80,
    },
    {
      title: 'KYC Status',
      dataIndex: 'kycStatus',
      key: 'kycStatus',
      width: 160,
      render: (val: string) => <KycStatusTag status={val} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string) => <MerchantStatusTag status={val} />,
    },
    {
      title: 'Payment Methods',
      dataIndex: 'paymentMethods',
      key: 'paymentMethods',
      width: 140,
      render: (pms: Merchant['paymentMethods']) => {
        if (!pms || pms.length === 0) return '-';
        const active = pms.filter((p) => p.status === 'ACTIVE').length;
        return `${active}/${pms.length} active`;
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_: unknown, record: Merchant) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/merchants/${record.id}`)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          Merchants{currentMerchant ? ` - ${currentMerchant.shopName}` : ''}
        </Title>
      </div>
      <Table<Merchant>
        dataSource={merchants}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: 'No merchants yet. Create one to get started!' }}
      />
    </div>
  );
}
