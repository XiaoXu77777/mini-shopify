import { Form, Input, Select, Divider, Typography, Button, Card, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { WizardData, WizardEntityAssociation } from '../index';

const { Title } = Typography;

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

const COMPANY_TYPE_OPTIONS = [
  { label: 'Enterprise', value: 'ENTERPRISE' },
  { label: 'Partnership', value: 'PARTNERSHIP' },
  { label: 'Sole Proprietorship', value: 'SOLE_PROPRIETORSHIP' },
  { label: 'State-owned Business', value: 'STATE_OWNED_BUSINESS' },
  { label: 'Private Business', value: 'PRIVATELY_OWNED_BUSINESS' },
  { label: 'Listed Company', value: 'PUBLICLY_LISTED_BUSINESS' },
];

const CERT_TYPE_OPTIONS = [
  { label: 'Enterprise Registration', value: 'ENTERPRISE_REGISTRATION' },
  { label: 'License Info', value: 'LICENSE_INFO' },
];

const COMPANY_UNIT_OPTIONS = [
  { label: 'Branch', value: 'BRANCH' },
  { label: 'Headquarters', value: 'HEADQUARTERS' },
];

const ID_TYPE_OPTIONS = [
  { label: 'ID Card', value: 'ID_CARD' },
  { label: 'Passport', value: 'PASSPORT' },
  { label: 'Driving License', value: 'DRIVING_LICENSE' },
];

const CONTACT_TYPE_OPTIONS = [
  { label: 'Email', value: 'EMAIL' },
  { label: 'Phone', value: 'PHONE_NO' },
  { label: 'CS Phone', value: 'CS_PHONE_NO' },
];

const ASSOCIATION_TYPE_OPTIONS = [
  { label: 'Director', value: 'DIRECTOR' },
  { label: 'UBO (Ultimate Beneficial Owner)', value: 'UBO' },
];

const emptyAssociation: WizardEntityAssociation = {
  associationType: 'DIRECTOR',
  shareholdingRatio: '',
  fullName: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  idType: '',
  idNo: '',
};

export default function KycFormStep({ data, onChange }: Props) {
  const updateAssociation = (index: number, field: string, value: string) => {
    const updated = [...data.entityAssociations];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ entityAssociations: updated });
  };

  const addAssociation = () => {
    onChange({ entityAssociations: [...data.entityAssociations, { ...emptyAssociation }] });
  };

  const removeAssociation = (index: number) => {
    onChange({ entityAssociations: data.entityAssociations.filter((_, i) => i !== index) });
  };

  return (
    <Form layout="vertical" style={{ maxWidth: 600 }}>
      <Title level={5}>Company Information</Title>
      <Form.Item label="Legal Name" required>
        <Input
          value={data.legalName}
          onChange={(e) => onChange({ legalName: e.target.value })}
          placeholder="Company legal name (same as on registration certificate)"
        />
      </Form.Item>
      <Form.Item label="Company Type" required>
        <Select
          value={data.companyType || undefined}
          onChange={(val) => onChange({ companyType: val })}
          placeholder="Select company type"
          options={COMPANY_TYPE_OPTIONS}
        />
      </Form.Item>
      <Form.Item label="Certificate Type" required>
        <Select
          value={data.certificateType || undefined}
          onChange={(val) => onChange({ certificateType: val })}
          placeholder="Select certificate type"
          options={CERT_TYPE_OPTIONS}
        />
      </Form.Item>
      <Form.Item label="Certificate No." required>
        <Input
          value={data.certificateNo}
          onChange={(e) => onChange({ certificateNo: e.target.value })}
          placeholder="Registration certificate number"
        />
      </Form.Item>
      <Form.Item label="Branch Name">
        <Input
          value={data.branchName}
          onChange={(e) => onChange({ branchName: e.target.value })}
          placeholder="Branch name (e.g. Head Office)"
        />
      </Form.Item>
      <Form.Item label="Company Unit">
        <Select
          value={data.companyUnit || undefined}
          onChange={(val) => onChange({ companyUnit: val })}
          placeholder="Select company unit"
          options={COMPANY_UNIT_OPTIONS}
          allowClear
        />
      </Form.Item>

      <Divider />
      <Title level={5}>Registered Address</Title>
      <Form.Item label="Region" required>
        <Select
          value={data.addressRegion || undefined}
          onChange={(val) => onChange({ addressRegion: val })}
          placeholder="Select region"
          showSearch
          options={[
            { label: 'CN - China', value: 'CN' },
            { label: 'US - United States', value: 'US' },
            { label: 'SG - Singapore', value: 'SG' },
            { label: 'HK - Hong Kong', value: 'HK' },
            { label: 'JP - Japan', value: 'JP' },
            { label: 'KR - South Korea', value: 'KR' },
          ]}
        />
      </Form.Item>
      <Form.Item label="State / Province" required>
        <Input
          value={data.addressState}
          onChange={(e) => onChange({ addressState: e.target.value })}
          placeholder="State or province"
        />
      </Form.Item>
      <Form.Item label="City" required>
        <Input
          value={data.addressCity}
          onChange={(e) => onChange({ addressCity: e.target.value })}
          placeholder="City"
        />
      </Form.Item>
      <Form.Item label="Address Line 1" required>
        <Input
          value={data.address1}
          onChange={(e) => onChange({ address1: e.target.value })}
          placeholder="Street address, PO box, company name"
        />
      </Form.Item>
      <Form.Item label="Address Line 2">
        <Input
          value={data.address2}
          onChange={(e) => onChange({ address2: e.target.value })}
          placeholder="Apartment, suite, unit, building (optional)"
        />
      </Form.Item>
      <Form.Item label="ZIP / Postal Code">
        <Input
          value={data.zipCode}
          onChange={(e) => onChange({ zipCode: e.target.value })}
          placeholder="ZIP or postal code (optional)"
        />
      </Form.Item>

      <Divider />
      <Title level={5}>Business Information</Title>
      <Form.Item label="App / Store Name" required>
        <Input
          value={data.appName}
          onChange={(e) => onChange({ appName: e.target.value })}
          placeholder="Application or store name"
        />
      </Form.Item>
      <Form.Item label="Merchant Brand Name">
        <Input
          value={data.merchantBrandName}
          onChange={(e) => onChange({ merchantBrandName: e.target.value })}
          placeholder="Brand name (optional)"
        />
      </Form.Item>
      <Form.Item label="MCC (Merchant Category Code)" required>
        <Input
          value={data.mcc}
          onChange={(e) => onChange({ mcc: e.target.value })}
          placeholder="4-digit code, e.g. 5021"
          maxLength={4}
        />
      </Form.Item>
      <Form.Item label="Doing Business As" required>
        <Input
          value={data.doingBusinessAs}
          onChange={(e) => onChange({ doingBusinessAs: e.target.value })}
          placeholder="Business name"
        />
      </Form.Item>
      <Form.Item label="Website URL" required>
        <Input
          value={data.websiteUrl}
          onChange={(e) => onChange({ websiteUrl: e.target.value })}
          placeholder="https://example.com"
        />
      </Form.Item>
      <Form.Item label="English Name">
        <Input
          value={data.englishName}
          onChange={(e) => onChange({ englishName: e.target.value })}
          placeholder="Company English name (optional)"
        />
      </Form.Item>
      <Form.Item label="Service Description">
        <Input.TextArea
          value={data.serviceDescription}
          onChange={(e) => onChange({ serviceDescription: e.target.value })}
          placeholder="Brief description of services (optional)"
          rows={2}
        />
      </Form.Item>

      <Divider />
      <Title level={5}>Contact Information</Title>
      <Form.Item label="Contact Type">
        <Select
          value={data.contactType || undefined}
          onChange={(val) => onChange({ contactType: val })}
          placeholder="Select contact type"
          options={CONTACT_TYPE_OPTIONS}
          allowClear
        />
      </Form.Item>
      <Form.Item label="Contact Details">
        <Input
          value={data.contactInfo}
          onChange={(e) => onChange({ contactInfo: e.target.value })}
          placeholder="Email address or phone number"
        />
      </Form.Item>

      <Divider />
      <Title level={5}>Legal Representative</Title>
      <Form.Item label="Full Name">
        <Input
          value={data.legalRepName}
          onChange={(e) => onChange({ legalRepName: e.target.value })}
          placeholder="Legal representative full name"
        />
      </Form.Item>
      <Form.Item label="ID Type">
        <Select
          value={data.legalRepIdType || undefined}
          onChange={(val) => onChange({ legalRepIdType: val })}
          placeholder="Select ID type"
          options={ID_TYPE_OPTIONS}
          allowClear
        />
      </Form.Item>
      <Form.Item label="ID Number">
        <Input
          value={data.legalRepIdNo}
          onChange={(e) => onChange({ legalRepIdNo: e.target.value })}
          placeholder="ID document number"
        />
      </Form.Item>
      <Form.Item label="Date of Birth">
        <Input
          value={data.legalRepDob}
          onChange={(e) => onChange({ legalRepDob: e.target.value })}
          placeholder="YYYY-MM-DD"
        />
      </Form.Item>

      <Divider />
      <Title level={5}>Directors / UBOs (Entity Associations)</Title>
      {data.entityAssociations.map((assoc, idx) => (
        <Card
          key={idx}
          size="small"
          title={`${assoc.associationType || 'Director'} #${idx + 1}`}
          extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeAssociation(idx)} />}
          style={{ marginBottom: 12 }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item label="Type" style={{ marginBottom: 8 }}>
              <Select
                value={assoc.associationType || undefined}
                onChange={(val) => updateAssociation(idx, 'associationType', val)}
                options={ASSOCIATION_TYPE_OPTIONS}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Full Name" style={{ marginBottom: 8 }}>
              <Input value={assoc.fullName} onChange={(e) => updateAssociation(idx, 'fullName', e.target.value)} placeholder="Full name" />
            </Form.Item>
            <Form.Item label="First Name" style={{ marginBottom: 8 }}>
              <Input value={assoc.firstName} onChange={(e) => updateAssociation(idx, 'firstName', e.target.value)} placeholder="First name" />
            </Form.Item>
            <Form.Item label="Last Name" style={{ marginBottom: 8 }}>
              <Input value={assoc.lastName} onChange={(e) => updateAssociation(idx, 'lastName', e.target.value)} placeholder="Last name" />
            </Form.Item>
            <Form.Item label="Date of Birth" style={{ marginBottom: 8 }}>
              <Input value={assoc.dateOfBirth} onChange={(e) => updateAssociation(idx, 'dateOfBirth', e.target.value)} placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item label="ID Type" style={{ marginBottom: 8 }}>
              <Select
                value={assoc.idType || undefined}
                onChange={(val) => updateAssociation(idx, 'idType', val)}
                options={ID_TYPE_OPTIONS}
                allowClear
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="ID Number" style={{ marginBottom: 8 }}>
              <Input value={assoc.idNo} onChange={(e) => updateAssociation(idx, 'idNo', e.target.value)} placeholder="ID number" />
            </Form.Item>
            {assoc.associationType === 'UBO' && (
              <Form.Item label="Shareholding Ratio (%)" style={{ marginBottom: 8 }}>
                <Input value={assoc.shareholdingRatio} onChange={(e) => updateAssociation(idx, 'shareholdingRatio', e.target.value)} placeholder="e.g. 33.5" />
              </Form.Item>
            )}
          </Space>
        </Card>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addAssociation}>
        Add Director / UBO
      </Button>
    </Form>
  );
}
