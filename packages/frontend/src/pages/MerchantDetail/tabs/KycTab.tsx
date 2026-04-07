import { useState } from 'react';
import { Descriptions, Alert, Typography, Divider, Empty, Input, Button, message, Space } from 'antd';
import { merchantApi } from '../../../services/merchantApi';
import type { Merchant } from '../../../types';

const { Text } = Typography;

interface Props {
  merchant: Merchant;
  onRefresh: () => void;
}

export default function KycTab({ merchant, onRefresh }: Props) {
  const kyc = merchant.kycInfo;
  const isSupplementRequired = merchant.kycStatus === 'SUPPLEMENT_REQUIRED';
  const rejectedFields: string[] = kyc?.rejectedFields || [];

  // Local state for editing rejected fields
  const [editValues, setEditValues] = useState<Record<string, string>>(() => {
    if (!isSupplementRequired || !kyc) return {};
    const initial: Record<string, string> = {};
    for (const field of rejectedFields) {
      const val = kyc[field as keyof typeof kyc];
      initial[field] = typeof val === 'string' ? val : '';
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  if (!kyc) {
    return <Empty description="No KYC information submitted yet" />;
  }

  const isRejected = (fieldName: string) => isSupplementRequired && rejectedFields.includes(fieldName);

  const highlightStyle = (fieldName: string): React.CSSProperties | undefined => {
    if (isRejected(fieldName)) {
      return { color: '#ff4d4f', fontWeight: 600 };
    }
    return undefined;
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const renderValue = (value: string | null | undefined, fieldName?: string) => {
    // If this field is rejected and supplement required, render an editable input
    if (fieldName && isRejected(fieldName)) {
      return (
        <Input
          size="small"
          value={editValues[fieldName] ?? value ?? ''}
          onChange={(e) => handleFieldChange(fieldName, e.target.value)}
          style={{ borderColor: '#ff4d4f' }}
        />
      );
    }
    if (!value) return <Text type="secondary">-</Text>;
    const style = fieldName ? highlightStyle(fieldName) : undefined;
    return style ? <Text style={style}>{value}</Text> : value;
  };

  const handleResubmit = async () => {
    setSubmitting(true);
    try {
      // 1. Build the full KYC data with edited values merged in
      const kycData: Record<string, unknown> = {
        legalName: kyc.legalName,
        companyType: kyc.companyType,
        certificateType: kyc.certificateType,
        certificateNo: kyc.certificateNo,
        branchName: kyc.branchName,
        companyUnit: kyc.companyUnit,
        addressRegion: kyc.addressRegion,
        addressState: kyc.addressState,
        addressCity: kyc.addressCity,
        address1: kyc.address1,
        address2: kyc.address2,
        zipCode: kyc.zipCode,
        mcc: kyc.mcc,
        doingBusinessAs: kyc.doingBusinessAs,
        websiteUrl: kyc.websiteUrl,
        englishName: kyc.englishName,
        serviceDescription: kyc.serviceDescription,
        appName: kyc.appName,
        merchantBrandName: kyc.merchantBrandName,
        contactType: kyc.contactType,
        contactInfo: kyc.contactInfo,
        legalRepName: kyc.legalRepName,
        legalRepIdType: kyc.legalRepIdType,
        legalRepIdNo: kyc.legalRepIdNo,
        legalRepDob: kyc.legalRepDob,
      };

      // Override with edited field values
      for (const [field, value] of Object.entries(editValues)) {
        kycData[field] = value;
      }

      // 2. Save updated KYC
      await merchantApi.submitKyc(merchant.id, kycData);

      // 3. Re-register with existing payment method types
      const pmTypes = merchant.paymentMethods.map((pm) => pm.paymentMethodType);
      if (pmTypes.length > 0) {
        await merchantApi.register(merchant.id, pmTypes);
      }

      message.success('KYC updated and resubmitted for review');
      onRefresh();
    } catch (err) {
      console.error('Resubmit error:', err);
      message.error('Failed to resubmit KYC');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      {isSupplementRequired && (
        <Alert
          message="Supplement Required"
          description={
            <>
              <Text>Some fields need to be corrected. Rejected fields are highlighted in red and editable below.</Text>
              {rejectedFields.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text strong>Rejected fields: </Text>
                  <Text>{rejectedFields.join(', ')}</Text>
                </div>
              )}
            </>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {merchant.kycStatus === 'PENDING' && merchant.registrationRequestId && (
        <Alert
          message="KYC Under Review"
          description="Registration has been submitted and is pending review. You will be notified when the review is complete."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {merchant.kycStatus === 'REJECTED' && (
        <Alert message="KYC Rejected" description="This merchant's KYC has been rejected." type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      {merchant.kycStatus === 'APPROVED' && (
        <Alert message="KYC Approved" type="success" showIcon style={{ marginBottom: 16 }} />
      )}

      <Divider orientation="horizontal" style={{ marginTop: 0 }}>Company Information</Divider>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="Legal Name">{renderValue(kyc.legalName, 'legalName')}</Descriptions.Item>
        <Descriptions.Item label="Company Type">{renderValue(kyc.companyType, 'companyType')}</Descriptions.Item>
        <Descriptions.Item label="Certificate Type">{renderValue(kyc.certificateType, 'certificateType')}</Descriptions.Item>
        <Descriptions.Item label="Certificate No.">{renderValue(kyc.certificateNo, 'certificateNo')}</Descriptions.Item>
        <Descriptions.Item label="Branch Name">{renderValue(kyc.branchName, 'branchName')}</Descriptions.Item>
        <Descriptions.Item label="Company Unit">{renderValue(kyc.companyUnit, 'companyUnit')}</Descriptions.Item>
      </Descriptions>

      <Divider>Registered Address</Divider>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="Region">{renderValue(kyc.addressRegion, 'addressRegion')}</Descriptions.Item>
        <Descriptions.Item label="State">{renderValue(kyc.addressState, 'addressState')}</Descriptions.Item>
        <Descriptions.Item label="City">{renderValue(kyc.addressCity, 'addressCity')}</Descriptions.Item>
        <Descriptions.Item label="ZIP Code">{renderValue(kyc.zipCode, 'zipCode')}</Descriptions.Item>
        <Descriptions.Item label="Address Line 1" span={2}>{renderValue(kyc.address1, 'address1')}</Descriptions.Item>
        <Descriptions.Item label="Address Line 2" span={2}>{renderValue(kyc.address2)}</Descriptions.Item>
      </Descriptions>

      <Divider>Business Information</Divider>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="App Name">{renderValue(kyc.appName, 'appName')}</Descriptions.Item>
        <Descriptions.Item label="Brand Name">{renderValue(kyc.merchantBrandName, 'merchantBrandName')}</Descriptions.Item>
        <Descriptions.Item label="MCC">{renderValue(kyc.mcc, 'mcc')}</Descriptions.Item>
        <Descriptions.Item label="DBA (Doing Business As)">{renderValue(kyc.doingBusinessAs, 'doingBusinessAs')}</Descriptions.Item>
        <Descriptions.Item label="Website URL">{renderValue(kyc.websiteUrl, 'websiteUrl')}</Descriptions.Item>
        <Descriptions.Item label="English Name">{renderValue(kyc.englishName)}</Descriptions.Item>
        <Descriptions.Item label="Service Description" span={2}>{renderValue(kyc.serviceDescription, 'serviceDescription')}</Descriptions.Item>
      </Descriptions>

      <Divider>Contact</Divider>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="Contact Type">{renderValue(kyc.contactType, 'contactType')}</Descriptions.Item>
        <Descriptions.Item label="Contact Info">{renderValue(kyc.contactInfo, 'contactInfo')}</Descriptions.Item>
      </Descriptions>

      <Divider>Legal Representative</Divider>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="Full Name">{renderValue(kyc.legalRepName, 'legalRepName')}</Descriptions.Item>
        <Descriptions.Item label="ID Type">{renderValue(kyc.legalRepIdType, 'legalRepIdType')}</Descriptions.Item>
        <Descriptions.Item label="ID Number">{renderValue(kyc.legalRepIdNo, 'legalRepIdNo')}</Descriptions.Item>
        <Descriptions.Item label="Date of Birth">{renderValue(kyc.legalRepDob, 'legalRepDob')}</Descriptions.Item>
      </Descriptions>

      {isSupplementRequired && (
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            <Button
              type="primary"
              loading={submitting}
              onClick={handleResubmit}
            >
              Save & Resubmit
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
}
