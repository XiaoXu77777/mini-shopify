import { Table, Button, Popconfirm, message } from 'antd';
import { merchantApi } from '../../../services/merchantApi';
import { PmStatusTag } from '../../../components/StatusTags';
import { PAYMENT_METHOD_OPTIONS } from '../../../utils/constants';
import type { Merchant, PaymentMethod } from '../../../types';

// Build a lookup map: e.g. { 'ALIPAY_HK': 'AlipayHK', 'VISA': 'Visa', ... }
const PM_TYPE_LABEL_MAP: Record<string, string> = {};
for (const opt of PAYMENT_METHOD_OPTIONS) {
  PM_TYPE_LABEL_MAP[opt.value] = opt.label;
}

interface Props {
  merchant: Merchant;
  onRefresh: () => void;
}

export default function PaymentMethodsTab({ merchant, onRefresh }: Props) {
  const handleDeactivate = async (pmId: string) => {
    try {
      await merchantApi.deactivatePaymentMethod(merchant.id, pmId);
      message.success('Payment method deactivated');
      onRefresh();
    } catch (err) {
      console.error('Deactivate error:', err);
      message.error('Failed to deactivate payment method');
    }
  };

  const columns = [
    {
      title: 'Payment Method',
      dataIndex: 'paymentMethodType',
      key: 'paymentMethodType',
      render: (val: string) => PM_TYPE_LABEL_MAP[val] || val,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => <PmStatusTag status={val} />,
    },
    {
      title: 'Activated At',
      dataIndex: 'activatedAt',
      key: 'activatedAt',
      render: (val: string | null) => (val ? new Date(val).toLocaleString() : '-'),
    },
    {
      title: 'Deactivated At',
      dataIndex: 'deactivatedAt',
      key: 'deactivatedAt',
      render: (val: string | null) => (val ? new Date(val).toLocaleString() : '-'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: PaymentMethod) => {
        if (record.status !== 'ACTIVE' || merchant.status === 'OFFBOARDED') return null;
        return (
          <Popconfirm
            title="Deactivate this payment method?"
            onConfirm={() => handleDeactivate(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger size="small">
              Deactivate
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <Table<PaymentMethod>
      dataSource={merchant.paymentMethods || []}
      columns={columns}
      rowKey="id"
      pagination={false}
      locale={{ emptyText: 'No payment methods' }}
    />
  );
}
