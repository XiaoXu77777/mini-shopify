import { useEffect, useState } from 'react';
import { Table, Tag, Typography } from 'antd';
import { merchantApi } from '../../../services/merchantApi';
import { NOTIFICATION_TYPE_LABELS } from '../../../utils/constants';
import type { Notification } from '../../../types';

interface Props {
  merchantId: string;
}

export default function NotificationsTab({ merchantId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    merchantApi
      .getNotifications(merchantId)
      .then((res) => setNotifications(res.data.data))
      .catch((err) => console.error('Failed to load notifications:', err))
      .finally(() => setLoading(false));
  }, [merchantId]);

  const columns = [
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
      render: (val: string) => <Tag>{NOTIFICATION_TYPE_LABELS[val] || val}</Tag>,
    },
    {
      title: 'Notify ID',
      dataIndex: 'notifyId',
      key: 'notifyId',
      ellipsis: true,
    },
    {
      title: 'Payload',
      dataIndex: 'payload',
      key: 'payload',
      render: (val: Record<string, unknown>) => (
        <Typography.Text code ellipsis style={{ maxWidth: 300 }}>
          {JSON.stringify(val)}
        </Typography.Text>
      ),
    },
  ];

  return (
    <Table<Notification>
      dataSource={notifications}
      columns={columns}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 20 }}
      expandable={{
        expandedRowRender: (record) => (
          <pre style={{ margin: 0, fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
            {JSON.stringify(record.payload, null, 2)}
          </pre>
        ),
      }}
      locale={{ emptyText: 'No notifications yet' }}
    />
  );
}
