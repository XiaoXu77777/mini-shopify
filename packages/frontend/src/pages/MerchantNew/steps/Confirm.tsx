import { Descriptions, Tag, Typography, Divider, Card } from 'antd';
import type { WizardData } from '../index';

const { Title, Text } = Typography;

interface Props {
  data: WizardData;
}

export default function ConfirmStep({ data }: Props) {
  return (
    <div style={{ maxWidth: 600 }}>
      <Title level={5}>Please review your registration details:</Title>

      <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Shop Name">{data.shopName}</Descriptions.Item>
        <Descriptions.Item label="Email">{data.email}</Descriptions.Item>
        <Descriptions.Item label="Region">{data.region}</Descriptions.Item>
        <Descriptions.Item label="WF Account">
          {data.wfAccountId || <span style={{ color: '#999' }}>Not connected</span>}
        </Descriptions.Item>
      </Descriptions>

      <Descriptions bordered column={1} size="small" title="Company Information" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Legal Name">{data.legalName || '-'}</Descriptions.Item>
        <Descriptions.Item label="Company Type">{data.companyType || '-'}</Descriptions.Item>
        <Descriptions.Item label="Certificate Type">{data.certificateType || '-'}</Descriptions.Item>
        <Descriptions.Item label="Certificate No.">{data.certificateNo || '-'}</Descriptions.Item>
        {data.branchName && <Descriptions.Item label="Branch Name">{data.branchName}</Descriptions.Item>}
        {data.companyUnit && <Descriptions.Item label="Company Unit">{data.companyUnit}</Descriptions.Item>}
      </Descriptions>

      <Descriptions bordered column={1} size="small" title="Registered Address" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Region">{data.addressRegion || '-'}</Descriptions.Item>
        <Descriptions.Item label="State">{data.addressState || '-'}</Descriptions.Item>
        <Descriptions.Item label="City">{data.addressCity || '-'}</Descriptions.Item>
        <Descriptions.Item label="Address">{data.address1 || '-'}</Descriptions.Item>
        {data.address2 && <Descriptions.Item label="Address 2">{data.address2}</Descriptions.Item>}
        {data.zipCode && <Descriptions.Item label="ZIP Code">{data.zipCode}</Descriptions.Item>}
      </Descriptions>

      <Descriptions bordered column={1} size="small" title="Business Information" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="App / Store Name">{data.appName || '-'}</Descriptions.Item>
        {data.merchantBrandName && <Descriptions.Item label="Brand Name">{data.merchantBrandName}</Descriptions.Item>}
        <Descriptions.Item label="MCC">{data.mcc || '-'}</Descriptions.Item>
        <Descriptions.Item label="Doing Business As">{data.doingBusinessAs || '-'}</Descriptions.Item>
        <Descriptions.Item label="Website">{data.websiteUrl || '-'}</Descriptions.Item>
        {data.englishName && <Descriptions.Item label="English Name">{data.englishName}</Descriptions.Item>}
        {data.serviceDescription && <Descriptions.Item label="Service">{data.serviceDescription}</Descriptions.Item>}
      </Descriptions>

      {(data.contactType || data.legalRepName) && (
        <Descriptions bordered column={1} size="small" title="Contact & Legal Rep" style={{ marginBottom: 16 }}>
          {data.contactType && <Descriptions.Item label="Contact Type">{data.contactType}</Descriptions.Item>}
          {data.contactInfo && <Descriptions.Item label="Contact Info">{data.contactInfo}</Descriptions.Item>}
          {data.legalRepName && <Descriptions.Item label="Legal Rep Name">{data.legalRepName}</Descriptions.Item>}
          {data.legalRepIdType && <Descriptions.Item label="ID Type">{data.legalRepIdType}</Descriptions.Item>}
          {data.legalRepIdNo && <Descriptions.Item label="ID No.">{data.legalRepIdNo}</Descriptions.Item>}
          {data.legalRepDob && <Descriptions.Item label="Date of Birth">{data.legalRepDob}</Descriptions.Item>}
        </Descriptions>
      )}

      {data.entityAssociations.length > 0 && (
        <>
          <Divider />
          <Title level={5}>Directors / UBOs</Title>
          {data.entityAssociations.map((assoc, idx) => (
            <Card key={idx} size="small" style={{ marginBottom: 8 }}>
              <Text strong>{assoc.associationType} #{idx + 1}: </Text>
              <Text>{assoc.fullName || `${assoc.firstName || ''} ${assoc.lastName || ''}`.trim() || '-'}</Text>
              {assoc.idType && <Text type="secondary"> ({assoc.idType}: {assoc.idNo})</Text>}
              {assoc.shareholdingRatio && <Text type="secondary"> - {assoc.shareholdingRatio}%</Text>}
            </Card>
          ))}
        </>
      )}

      <Divider />
      <Title level={5}>Payment Methods</Title>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {data.paymentMethodTypes.map((pm) => (
          <Tag key={pm} color="blue">{pm}</Tag>
        ))}
      </div>
    </div>
  );
}
