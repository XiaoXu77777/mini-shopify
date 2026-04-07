import { useEffect, useState } from 'react';
import { Card, Typography, Descriptions, Divider, Select, Space, message, Tag, Switch, InputNumber, Input, Form } from 'antd';
import { useAppContext } from '../context/AppContext';
import { merchantApi } from '../services/merchantApi';
import { ALL_PAYMENT_METHOD_TYPES } from '../utils/constants';
import type { MockPresets } from '../types';

const { Title, Text } = Typography;

const KYC_RESULT_OPTIONS = [
  { label: 'APPROVED', value: 'APPROVED' },
  { label: 'REJECTED', value: 'REJECTED' },
  { label: 'SUPPLEMENT_REQUIRED', value: 'SUPPLEMENT_REQUIRED' },
];

const PM_STATUS_OPTIONS = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
];

const RISK_LEVEL_OPTIONS = [
  { label: 'HIGH', value: 'HIGH' },
  { label: 'MEDIUM', value: 'MEDIUM' },
  { label: 'LOW', value: 'LOW' },
];

export default function Settings() {
  const { config, refreshConfig } = useAppContext();
  const [switching, setSwitching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejectedReasonLocal, setRejectedReasonLocal] = useState(config?.mockPresets?.rejectedReason ?? '');

  useEffect(() => {
    setRejectedReasonLocal(config?.mockPresets?.rejectedReason ?? '');
  }, [config?.mockPresets?.rejectedReason]);

  const handleModeSwitch = async (mockMode: boolean) => {
    setSwitching(true);
    try {
      await merchantApi.updateConfig({ mockMode });
      await refreshConfig();
      message.success(`Switched to ${mockMode ? 'Mock' : 'Production'} mode`);
    } catch (err) {
      console.error('Switch mode error:', err);
      message.error('Failed to switch mode');
    } finally {
      setSwitching(false);
    }
  };

  const handleDelayChange = async (value: number | null) => {
    if (!value || value <= 0) return;
    try {
      await merchantApi.updateConfig({ mockNotifyDelayMs: value });
      await refreshConfig();
    } catch (err) {
      console.error('Update delay error:', err);
    }
  };

  const handlePresetChange = async (partial: Partial<MockPresets>) => {
    setSaving(true);
    try {
      await merchantApi.updateConfig({ mockPresets: partial });
      await refreshConfig();
      message.success('Mock preset saved');
    } catch (err) {
      console.error('Update preset error:', err);
      message.error('Failed to save mock preset');
    } finally {
      setSaving(false);
    }
  };

  const handlePmStatusChange = async (pmType: string, status: 'ACTIVE' | 'INACTIVE') => {
    const updated = { ...presets?.paymentMethodStatuses, [pmType]: status };
    await handlePresetChange({ paymentMethodStatuses: updated });
  };

  const presets = config?.mockPresets;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Settings</Title>

      <Card title="System Configuration" style={{ marginBottom: 24 }}>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Running Mode">
            <Space>
              <Switch
                checked={config?.mockMode}
                onChange={handleModeSwitch}
                loading={switching}
                checkedChildren="Mock"
                unCheckedChildren="Prod"
              />
              <Tag color={config?.mockMode ? 'blue' : 'orange'}>
                {config?.mockMode ? 'MOCK' : 'PRODUCTION'}
              </Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Mock Notify Delay">
            <Space>
              <InputNumber
                value={config?.mockNotifyDelayMs}
                min={100}
                max={30000}
                step={500}
                addonAfter="ms"
                disabled={!config?.mockMode}
                onBlur={(e) => handleDelayChange(Number(e.target.value))}
                onPressEnter={(e) => handleDelayChange(Number((e.target as HTMLInputElement).value))}
                style={{ width: 160 }}
              />
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Antom Base URL">
            {config?.antomBaseUrl ?? '-'}
          </Descriptions.Item>
        </Descriptions>
        <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          Toggle the switch above to change between Mock and Production mode at runtime.
          In Production mode, real Antom API calls will be made (requires valid credentials).
        </Text>
      </Card>

      {config?.mockMode && presets && (
      <Card title="Mock Notification Presets" extra={<Tag color="blue">Pre-configured</Tag>}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Configure the mock notification results below. When a merchant registers, mock notifications
          will be sent automatically based on these presets.
        </Text>

        <Form layout="vertical" style={{ maxWidth: 600 }}>
          <Divider titlePlacement="start">Registration Status</Divider>

          <Form.Item label="KYC Result">
            <Select
              value={presets.kycResult}
              options={KYC_RESULT_OPTIONS}
              onChange={(val) => handlePresetChange({ kycResult: val })}
              disabled={saving}
              style={{ width: 240 }}
            />
          </Form.Item>

          {(presets.kycResult === 'REJECTED' || presets.kycResult === 'SUPPLEMENT_REQUIRED') && (
            <Form.Item label="Rejected Reason">
              <Input
                value={rejectedReasonLocal}
                placeholder="e.g. Verification failed"
                onChange={(e) => setRejectedReasonLocal(e.target.value)}
                onBlur={(e) => handlePresetChange({ rejectedReason: e.target.value })}
                onPressEnter={(e) => handlePresetChange({ rejectedReason: (e.target as HTMLInputElement).value })}
                disabled={saving}
              />
            </Form.Item>
          )}

          {presets.kycResult === 'SUPPLEMENT_REQUIRED' && (
            <Form.Item label="Rejected Fields">
              <Select
                mode="tags"
                value={presets.rejectedFields}
                placeholder="e.g. certificateNo, legalRepIdNo"
                onChange={(val) => handlePresetChange({ rejectedFields: val })}
                disabled={saving}
                style={{ width: '100%' }}
                options={[
                  { label: 'legalName', value: 'legalName' },
                  { label: 'companyType', value: 'companyType' },
                  { label: 'certificateType', value: 'certificateType' },
                  { label: 'certificateNo', value: 'certificateNo' },
                  { label: 'addressRegion', value: 'addressRegion' },
                  { label: 'addressState', value: 'addressState' },
                  { label: 'addressCity', value: 'addressCity' },
                  { label: 'address1', value: 'address1' },
                  { label: 'mcc', value: 'mcc' },
                  { label: 'doingBusinessAs', value: 'doingBusinessAs' },
                  { label: 'websiteUrl', value: 'websiteUrl' },
                  { label: 'appName', value: 'appName' },
                  { label: 'contactType', value: 'contactType' },
                  { label: 'contactInfo', value: 'contactInfo' },
                  { label: 'legalRepName', value: 'legalRepName' },
                  { label: 'legalRepIdType', value: 'legalRepIdType' },
                  { label: 'legalRepIdNo', value: 'legalRepIdNo' },
                  { label: 'legalRepDob', value: 'legalRepDob' },
                ]}
              />
            </Form.Item>
          )}

          <Divider titlePlacement="start">Payment Method Activation</Divider>

          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Configure the mock result for each payment method. Unset methods default to ACTIVE.
          </Text>

          {ALL_PAYMENT_METHOD_TYPES.map((pmType) => (
            <Form.Item key={pmType} label={pmType} style={{ marginBottom: 8 }}>
              <Select
                value={presets.paymentMethodStatuses[pmType] || 'ACTIVE'}
                options={PM_STATUS_OPTIONS}
                onChange={(val) => handlePmStatusChange(pmType, val)}
                disabled={saving}
                style={{ width: 160 }}
              />
            </Form.Item>
          ))}

          <Divider titlePlacement="start">Risk Notification</Divider>

          <Form.Item label="Send Risk Notification">
            <Switch
              checked={presets.riskEnabled}
              onChange={(val) => handlePresetChange({ riskEnabled: val })}
              disabled={saving}
              checkedChildren="Yes"
              unCheckedChildren="No"
            />
          </Form.Item>

          {presets.riskEnabled && (
            <>
              <Form.Item label="Risk Level">
                <Select
                  value={presets.riskLevel}
                  options={RISK_LEVEL_OPTIONS}
                  onChange={(val) => handlePresetChange({ riskLevel: val })}
                  disabled={saving}
                  style={{ width: 240 }}
                />
              </Form.Item>

              <Form.Item label="Risk Reason Codes">
                <Select
                  mode="tags"
                  value={presets.riskReasonCodes}
                  placeholder="e.g. R001, R002"
                  onChange={(val) => handlePresetChange({ riskReasonCodes: val })}
                  disabled={saving}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </>
          )}
        </Form>

        <Divider />
        <Text type="secondary">
          These presets take effect automatically when a merchant registers in Mock mode.
          No manual triggering is needed.
        </Text>
      </Card>
      )}
    </div>
  );
}
