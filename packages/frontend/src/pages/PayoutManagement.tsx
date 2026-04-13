import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Typography, Spin, message, Modal, Descriptions, Tag, Divider } from 'antd';
import { ArrowLeftOutlined, DollarOutlined, ReloadOutlined } from '@ant-design/icons';
import { merchantApi } from '../services/merchantApi';

const { Title, Text } = Typography;

interface PayoutAccount {
  settlementAccountType?: string;
  settlementAccountInfo?: {
    accountNo?: string;
  };
  [key: string]: unknown;
}

interface SettlementSetting {
  settlementCurrency?: string;
  settlementDescriptor?: string;
  settlementStatus?: string;
  settlementRule?: Record<string, unknown>;
  minSettlementAmount?: Record<string, unknown>;
  effectiveTime?: number;
  [key: string]: unknown;
}

interface PayoutSettings {
  settlementSetting?: SettlementSetting;
  result?: Record<string, unknown>;
  [key: string]: unknown;
}

export default function PayoutManagement() {
  const { id: merchantId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [referenceMerchantId, setReferenceMerchantId] = useState<string | null>(null);
  const [settlementCurrency, setSettlementCurrency] = useState('HKD');
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Fetch merchant info to get referenceMerchantId
  useEffect(() => {
    if (!merchantId) return;

    const fetchMerchant = async () => {
      try {
        const res = await merchantApi.getById(merchantId);
        setReferenceMerchantId(res.data.referenceMerchantId);
        setSettlementCurrency(res.data.settlementCurrency || 'HKD');
      } catch {
        message.error('Failed to load merchant information.');
      } finally {
        setLoading(false);
      }
    };

    fetchMerchant();
  }, [merchantId]);

  const fetchAccounts = useCallback(async () => {
    if (!referenceMerchantId) return;

    setAccountsLoading(true);
    try {
      const res = await merchantApi.queryPayoutAccounts(merchantId!);
      const data = res.data;
      const accountList = data?.settlementInfoList ?? [];
      setAccounts(accountList as PayoutAccount[]);
    } catch {
      message.error('Failed to load payout accounts.');
    } finally {
      setAccountsLoading(false);
    }
  }, [referenceMerchantId]);

  const fetchSettings = useCallback(async () => {
    if (!referenceMerchantId) return;

    setSettingsLoading(true);
    try {
      const res = await merchantApi.queryPayoutSettings(merchantId!, settlementCurrency);
      setSettings(res.data as PayoutSettings);
    } catch {
      message.error('Failed to load payout settings.');
    } finally {
      setSettingsLoading(false);
    }
  }, [referenceMerchantId, settlementCurrency]);

  // Fetch accounts and settings once referenceMerchantId is available
  useEffect(() => {
    if (referenceMerchantId) {
      fetchAccounts();
      fetchSettings();
    }
  }, [referenceMerchantId, fetchAccounts, fetchSettings]);

  const handleEnablePayout = async () => {
    if (!merchantId) return;

    setUpdating(true);
    try {
      await merchantApi.updatePayoutSettings(merchantId, {
        requestId: String(Date.now()),
        settlementCurrency,
        payoutActionType: 'PAYOUT_ENABLE',
        settlementSetting: {},
      });
      message.success('Payout enabled successfully.');
      fetchSettings();
    } catch {
      message.error('Failed to enable payout.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDisablePayout = async () => {
    if (!merchantId) return;

    setUpdating(true);
    try {
      await merchantApi.updatePayoutSettings(merchantId, {
        requestId: String(Date.now()),
        settlementCurrency,
        payoutActionType: 'PAYOUT_DISABLE',
        settlementSetting: {},
      });
      message.success('Payout disabled successfully.');
      fetchSettings();
    } catch {
      message.error('Failed to disable payout.');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!merchantId) return;

    setUpdating(true);
    try {
      await merchantApi.updatePayoutSettings(merchantId, {
        requestId: String(Date.now()),
        settlementCurrency,
        payoutActionType: 'UPDATE_SETTINGS',
        settlementSetting: settings?.settlementSetting ?? {},
      });
      message.success('Payout settings updated successfully.');
      setUpdateModalOpen(false);
      fetchSettings();
    } catch {
      message.error('Failed to update payout settings.');
    } finally {
      setUpdating(false);
    }
  };

  const accountColumns = [
    {
      title: 'Account Type',
      dataIndex: 'settlementAccountType',
      key: 'settlementAccountType',
      render: (val: string) => val ? <Tag color="blue">{val}</Tag> : '-',
    },
    {
      title: 'Account Number',
      dataIndex: ['settlementAccountInfo', 'accountNo'],
      key: 'accountNo',
      render: (val: string) => val || '-',
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Loading merchant information...</Text>
        </div>
      </div>
    );
  }

  if (!referenceMerchantId) {
    return (
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/merchants/${merchantId}`)}
          style={{ marginBottom: 16 }}
        >
          Back
        </Button>
        <Card>
          <Text type="secondary">
            This merchant does not have a reference merchant ID yet. Please complete the payment setup first.
          </Text>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/merchants/${merchantId}`)}
        >
          Back
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          <DollarOutlined style={{ marginRight: 8 }} />
          Settlement Management
        </Title>
      </Space>

      {/* Payout Accounts */}
      <Card
        title="Payout Accounts"
        style={{ marginBottom: 24 }}
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAccounts}
            loading={accountsLoading}
          >
            Refresh
          </Button>
        }
      >
        <Table
          columns={accountColumns}
          dataSource={accounts}
          rowKey={(_, index) => String(index)}
          loading={accountsLoading}
          pagination={false}
          locale={{ emptyText: 'No payout accounts found.' }}
        />
      </Card>

      {/* Payout Settings */}
      <Card
        title="Payout Settings"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchSettings}
            loading={settingsLoading}
          >
            Refresh
          </Button>
        }
      >
        {settingsLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : settings ? (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Currency">
                <Tag color="blue">{settings.settlementSetting?.settlementCurrency || settlementCurrency}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Settlement Status">
                {settings.settlementSetting?.settlementStatus ? (
                  <Tag color={settings.settlementSetting.settlementStatus === 'ENABLED' ? 'green' : 'red'}>
                    {settings.settlementSetting.settlementStatus}
                  </Tag>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              {settings.settlementSetting?.settlementDescriptor && (
                <Descriptions.Item label="Settlement Descriptor">
                  {settings.settlementSetting.settlementDescriptor}
                </Descriptions.Item>
              )}
              {settings.settlementSetting?.settlementRule && (
                <Descriptions.Item label="Settlement Rule">
                  <pre style={{ margin: 0, fontSize: 12 }}>
                    {JSON.stringify(settings.settlementSetting.settlementRule, null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
              {settings.settlementSetting?.minSettlementAmount && (
                <Descriptions.Item label="Min Settlement Amount">
                  {`${settings.settlementSetting.minSettlementAmount.amount} ${settings.settlementSetting.minSettlementAmount.currency || ''}`}
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        ) : (
          <Text type="secondary">No payout settings found for currency {settlementCurrency}.</Text>
        )}

        <Divider />

        <Space>
          <Button
            type="primary"
            onClick={handleEnablePayout}
            loading={updating}
          >
            Enable Payout
          </Button>
          <Button
            danger
            onClick={handleDisablePayout}
            loading={updating}
          >
            Disable Payout
          </Button>
          <Button
            onClick={() => setUpdateModalOpen(true)}
          >
            Update Settings
          </Button>
        </Space>
      </Card>

      {/* Update Settings Modal */}
      <Modal
        title="Update Payout Settings"
        open={updateModalOpen}
        onOk={handleUpdateSettings}
        onCancel={() => setUpdateModalOpen(false)}
        confirmLoading={updating}
        okText="Update"
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Currency">
            <Tag color="blue">{settlementCurrency}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Action Type">UPDATE</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">
            This will send an UPDATE request with the current settlement settings for currency {settlementCurrency}.
          </Text>
        </div>
      </Modal>
    </div>
  );
}
