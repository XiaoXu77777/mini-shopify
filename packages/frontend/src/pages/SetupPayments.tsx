import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Typography, Button, Steps, Result, Spin, Alert, message, Form, Input, Select, Divider, Space } from 'antd';
import { LoadingOutlined, UserAddOutlined, LinkOutlined } from '@ant-design/icons';
import { merchantApi } from '../services/merchantApi';

const { Title, Paragraph } = Typography;

const WF_SIGNUP_URL = 'https://www.worldfirst.com/uk/?utm_medium=cpc&utm_source=google&utm_campaign=CPC_google_monks_us_brand_worldfirst&utm_term=CPC_US_Brand_worldfirst&utm_content=[WorldFirst]&utm_date=295279591102&gad_so';

type SetupPhase = 'question' | 'oauth-redirect' | 'kyc-form' | 'submitting' | 'done' | 'error';

interface KycData {
  legalName: string;
  companyType: string;
  certificateType: string;
  certificateNo: string;
  branchName: string;
  companyUnit: string;
  addressRegion: string;
  addressState: string;
  addressCity: string;
  address1: string;
  address2: string;
  zipCode: string;
  mcc: string;
  doingBusinessAs: string;
  websiteUrl: string;
  englishName: string;
  serviceDescription: string;
  appName: string;
  merchantBrandName: string;
  contactType: string;
  contactInfo: string;
  legalRepName: string;
  legalRepIdType: string;
  legalRepIdNo: string;
  legalRepDob: string;
  entityAssociations: {
    associationType: string;
    shareholdingRatio: string;
    fullName: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    idType: string;
    idNo: string;
  }[];
}

const emptyKycData: KycData = {
  legalName: '',
  companyType: '',
  certificateType: '',
  certificateNo: '',
  branchName: '',
  companyUnit: '',
  addressRegion: '',
  addressState: '',
  addressCity: '',
  address1: '',
  address2: '',
  zipCode: '',
  mcc: '',
  doingBusinessAs: '',
  websiteUrl: '',
  englishName: '',
  serviceDescription: '',
  appName: '',
  merchantBrandName: '',
  contactType: '',
  contactInfo: '',
  legalRepName: '',
  legalRepIdType: '',
  legalRepIdNo: '',
  legalRepDob: '',
  entityAssociations: [],
};

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

export default function SetupPayments() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<SetupPhase>('question');
  const [errorMessage, setErrorMessage] = useState('');
  const [kycData, setKycData] = useState<KycData>(emptyKycData);
  const [wfAuthData, setWfAuthData] = useState<{ accessToken: string; customerId: string; wfAccountId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Check for OAuth callback
  useEffect(() => {
    const authCode = searchParams.get('authCode');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setPhase('error');
      setErrorMessage(`Authorization failed: ${error}`);
      return;
    }

    if (authCode && state && id) {
      // Handle OAuth callback
      handleOAuthCallback(authCode, state);
    }
  }, [searchParams, id]);

  const handleOAuthCallback = async (authCode: string, _state: string) => {
    try {
      setPhase('oauth-redirect');
      
      // Exchange authCode for accessToken
      const tokenRes = await merchantApi.exchangeWfToken(authCode);
      
      if (!tokenRes.data.success || !tokenRes.data.accessToken) {
        setPhase('error');
        setErrorMessage(tokenRes.data.error || 'Failed to exchange authorization code');
        return;
      }

      const { accessToken = '', customerId = '', wfAccountId = '' } = tokenRes.data;
      setWfAuthData({ accessToken, customerId, wfAccountId });

      // Query KYB info (customerId may be empty for WF OAuth flow)
      const kybRes = await merchantApi.queryWfKybInfo(accessToken, customerId);
      
      if (kybRes.data.success && kybRes.data.kybData) {
        const kyb = kybRes.data.kybData as Record<string, unknown>;
        
        // Pre-fill KYC form with KYB data
        setKycData({
          legalName: String(kyb.legalName || ''),
          companyType: String(kyb.companyType || ''),
          certificateType: String(kyb.certificateType || ''),
          certificateNo: String(kyb.certificateNo || ''),
          branchName: String(kyb.branchName || ''),
          companyUnit: String(kyb.companyUnit || ''),
          addressRegion: String(kyb.addressRegion || ''),
          addressState: String(kyb.addressState || ''),
          addressCity: String(kyb.addressCity || ''),
          address1: String(kyb.address1 || ''),
          address2: String(kyb.address2 || ''),
          zipCode: String(kyb.zipCode || ''),
          mcc: String(kyb.mcc || ''),
          doingBusinessAs: String(kyb.doingBusinessAs || ''),
          websiteUrl: String(kyb.websiteUrl || ''),
          englishName: String(kyb.englishName || ''),
          serviceDescription: String(kyb.serviceDescription || ''),
          appName: String(kyb.appName || ''),
          merchantBrandName: String(kyb.merchantBrandName || ''),
          contactType: String(kyb.contactType || ''),
          contactInfo: String(kyb.contactInfo || ''),
          legalRepName: String(kyb.legalRepName || ''),
          legalRepIdType: String(kyb.legalRepIdType || ''),
          legalRepIdNo: String(kyb.legalRepIdNo || ''),
          legalRepDob: String(kyb.legalRepDob || ''),
          entityAssociations: Array.isArray(kyb.entityAssociations)
            ? (kyb.entityAssociations as Record<string, unknown>[]).map((ea) => {
                // WF returns nested: { associationType, legalEntityType, individual: { name: { fullName }, certificates: [...] } }
                // Frontend expects flat: { associationType, fullName, firstName, lastName, idType, idNo, ... }
                const ind = ea.individual as Record<string, unknown> | undefined;
                const name = ind?.name as Record<string, unknown> | undefined;
                const certs = ind?.certificates as Array<Record<string, unknown>> | undefined;
                const firstCert = certs?.[0];
                return {
                  associationType: String(ea.associationType || 'DIRECTOR'),
                  shareholdingRatio: ea.shareholdingRatio != null ? String(ea.shareholdingRatio) : '',
                  fullName: String(name?.fullName || ea.fullName || ''),
                  firstName: String(name?.firstName || ea.firstName || ''),
                  lastName: String(name?.lastName || ea.lastName || ''),
                  dateOfBirth: String(ind?.dateOfBirth || ea.dateOfBirth || ''),
                  idType: String(firstCert?.certificateType || ea.idType || ''),
                  idNo: String(firstCert?.certificateNo || ea.idNo || ''),
                };
              })
            : [],
        });
        
        setPhase('kyc-form');
        message.success('KYB information loaded successfully!');
      } else {
        setPhase('error');
        setErrorMessage(kybRes.data.error || 'Failed to load KYB information');
      }
    } catch (err) {
      console.error('OAuth callback error:', err);
      setPhase('error');
      setErrorMessage('Failed to complete authorization. Please try again.');
    }
  };

  const handleHasAccount = async () => {
    if (!id) return;
    
    try {
      // Get OAuth URL from backend
      const res = await merchantApi.getWfOAuthUrl(id);
      
      if (res.data.success && res.data.oauthUrl) {
        // Redirect to WorldFirst OAuth page
        window.location.href = res.data.oauthUrl;
      } else {
        message.error(res.data.error || 'Failed to get authorization URL');
      }
    } catch (err) {
      console.error('Get OAuth URL error:', err);
      message.error('Failed to initiate authorization. Please try again.');
    }
  };

  const handleNoAccount = () => {
    window.open(WF_SIGNUP_URL, '_blank');
  };

  const updateKycField = (field: keyof KycData, value: unknown) => {
    setKycData(prev => ({ ...prev, [field]: value }));
  };

  const updateAssociation = (index: number, field: string, value: string) => {
    const updated = [...kycData.entityAssociations];
    updated[index] = { ...updated[index], [field]: value };
    setKycData(prev => ({ ...prev, entityAssociations: updated }));
  };

  const addAssociation = () => {
    setKycData(prev => ({
      ...prev,
      entityAssociations: [...prev.entityAssociations, {
        associationType: 'DIRECTOR',
        shareholdingRatio: '',
        fullName: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        idType: '',
        idNo: '',
      }],
    }));
  };

  const removeAssociation = (index: number) => {
    setKycData(prev => ({
      ...prev,
      entityAssociations: prev.entityAssociations.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!id || !wfAuthData) return;

    setSubmitting(true);
    try {
      // Use setup-payments API to complete the full flow
      const result = await merchantApi.setupPayments(id, {
        wfAccountId: wfAuthData.wfAccountId,
        accessToken: wfAuthData.accessToken,
        customerId: wfAuthData.customerId,
      });

      if (result.data.success) {
        setPhase('done');
        message.success('Shopify Payments setup complete!');
      } else {
        setPhase('error');
        setErrorMessage(result.data.error || 'Failed to setup payments');
      }
    } catch (err: unknown) {
      console.error('Setup payments error:', err);
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setPhase('error');
      setErrorMessage(axiosErr?.response?.data?.error || 'Failed to setup payments. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Phase: Question (Do you have WF account?)
  if (phase === 'question') {
    return (
      <div>
        <Title level={3} style={{ marginBottom: 24 }}>Set up Shopify Payments</Title>
        <Card style={{ maxWidth: 600 }}>
          <Title level={4}>Do you have an existing WorldFirst account?</Title>
          <Paragraph type="secondary" style={{ marginBottom: 32 }}>
            WorldFirst is our payment partner. You need a WorldFirst account to enable Shopify Payments.
          </Paragraph>

          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Button
              type="primary"
              icon={<LinkOutlined />}
              size="large"
              block
              onClick={handleHasAccount}
            >
              Yes, I have a WorldFirst account
            </Button>
            <Button
              icon={<UserAddOutlined />}
              size="large"
              block
              onClick={handleNoAccount}
            >
              No, I need to create one
            </Button>
          </Space>

          <Paragraph type="secondary" style={{ marginTop: 24 }}>
            If you don't have an account yet, click "No" to visit WorldFirst and create one first. 
            Then come back and select "Yes" to connect your account.
          </Paragraph>
        </Card>
      </div>
    );
  }

  // Phase: OAuth Redirect (loading)
  if (phase === 'oauth-redirect') {
    return (
      <div>
        <Title level={3} style={{ marginBottom: 24 }}>Set up Shopify Payments</Title>
        <Card style={{ maxWidth: 600, textAlign: 'center', padding: 48 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
          <Title level={4} style={{ marginTop: 24 }}>Connecting to WorldFirst...</Title>
          <Paragraph type="secondary">
            Please wait while we complete the authorization and load your KYB information.
          </Paragraph>
        </Card>
      </div>
    );
  }

  // Phase: KYC Form
  if (phase === 'kyc-form') {
    return (
      <div>
        <Title level={3} style={{ marginBottom: 24 }}>Set up Shopify Payments</Title>
        <Card>
          <Alert
            message="WorldFirst Account Connected"
            description="Your KYB information has been pre-filled from WorldFirst. Please review and update if necessary."
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Steps current={1} items={[
            { title: 'Connect WorldFirst' },
            { title: 'Review KYC Info' },
            { title: 'Submit' },
          ]} style={{ marginBottom: 32 }} />

          <Form layout="vertical" style={{ maxWidth: 800 }}>
            <Title level={5}>Company Information</Title>
            <Form.Item label="Legal Name" required>
              <Input
                value={kycData.legalName}
                onChange={(e) => updateKycField('legalName', e.target.value)}
                placeholder="Company legal name"
              />
            </Form.Item>
            <Form.Item label="Company Type" required>
              <Select
                value={kycData.companyType || undefined}
                onChange={(val) => updateKycField('companyType', val)}
                placeholder="Select company type"
                options={COMPANY_TYPE_OPTIONS}
              />
            </Form.Item>
            <Form.Item label="Certificate Type" required>
              <Select
                value={kycData.certificateType || undefined}
                onChange={(val) => updateKycField('certificateType', val)}
                placeholder="Select certificate type"
                options={CERT_TYPE_OPTIONS}
              />
            </Form.Item>
            <Form.Item label="Certificate No." required>
              <Input
                value={kycData.certificateNo}
                onChange={(e) => updateKycField('certificateNo', e.target.value)}
                placeholder="Registration certificate number"
              />
            </Form.Item>
            <Form.Item label="Branch Name">
              <Input
                value={kycData.branchName}
                onChange={(e) => updateKycField('branchName', e.target.value)}
                placeholder="Branch name"
              />
            </Form.Item>
            <Form.Item label="Company Unit">
              <Select
                value={kycData.companyUnit || undefined}
                onChange={(val) => updateKycField('companyUnit', val)}
                placeholder="Select company unit"
                options={COMPANY_UNIT_OPTIONS}
                allowClear
              />
            </Form.Item>

            <Divider />
            <Title level={5}>Registered Address</Title>
            <Form.Item label="Region" required>
              <Select
                value={kycData.addressRegion || undefined}
                onChange={(val) => updateKycField('addressRegion', val)}
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
                value={kycData.addressState}
                onChange={(e) => updateKycField('addressState', e.target.value)}
                placeholder="State or province"
              />
            </Form.Item>
            <Form.Item label="City" required>
              <Input
                value={kycData.addressCity}
                onChange={(e) => updateKycField('addressCity', e.target.value)}
                placeholder="City"
              />
            </Form.Item>
            <Form.Item label="Address Line 1" required>
              <Input
                value={kycData.address1}
                onChange={(e) => updateKycField('address1', e.target.value)}
                placeholder="Street address"
              />
            </Form.Item>
            <Form.Item label="Address Line 2">
              <Input
                value={kycData.address2}
                onChange={(e) => updateKycField('address2', e.target.value)}
                placeholder="Apartment, suite, unit (optional)"
              />
            </Form.Item>
            <Form.Item label="ZIP / Postal Code">
              <Input
                value={kycData.zipCode}
                onChange={(e) => updateKycField('zipCode', e.target.value)}
                placeholder="ZIP or postal code"
              />
            </Form.Item>

            <Divider />
            <Title level={5}>Business Information</Title>
            <Form.Item label="App / Store Name" required>
              <Input
                value={kycData.appName}
                onChange={(e) => updateKycField('appName', e.target.value)}
                placeholder="Application or store name"
              />
            </Form.Item>
            <Form.Item label="Merchant Brand Name">
              <Input
                value={kycData.merchantBrandName}
                onChange={(e) => updateKycField('merchantBrandName', e.target.value)}
                placeholder="Brand name"
              />
            </Form.Item>
            <Form.Item label="MCC (Merchant Category Code)" required>
              <Input
                value={kycData.mcc}
                onChange={(e) => updateKycField('mcc', e.target.value)}
                placeholder="4-digit code, e.g. 5021"
                maxLength={4}
              />
            </Form.Item>
            <Form.Item label="Doing Business As" required>
              <Input
                value={kycData.doingBusinessAs}
                onChange={(e) => updateKycField('doingBusinessAs', e.target.value)}
                placeholder="Business name"
              />
            </Form.Item>
            <Form.Item label="Website URL" required>
              <Input
                value={kycData.websiteUrl}
                onChange={(e) => updateKycField('websiteUrl', e.target.value)}
                placeholder="https://example.com"
              />
            </Form.Item>
            <Form.Item label="English Name">
              <Input
                value={kycData.englishName}
                onChange={(e) => updateKycField('englishName', e.target.value)}
                placeholder="Company English name"
              />
            </Form.Item>
            <Form.Item label="Service Description">
              <Input.TextArea
                value={kycData.serviceDescription}
                onChange={(e) => updateKycField('serviceDescription', e.target.value)}
                placeholder="Brief description of services"
                rows={2}
              />
            </Form.Item>

            <Divider />
            <Title level={5}>Contact Information</Title>
            <Form.Item label="Contact Type">
              <Select
                value={kycData.contactType || undefined}
                onChange={(val) => updateKycField('contactType', val)}
                placeholder="Select contact type"
                options={CONTACT_TYPE_OPTIONS}
                allowClear
              />
            </Form.Item>
            <Form.Item label="Contact Details">
              <Input
                value={kycData.contactInfo}
                onChange={(e) => updateKycField('contactInfo', e.target.value)}
                placeholder="Email or phone number"
              />
            </Form.Item>

            <Divider />
            <Title level={5}>Legal Representative</Title>
            <Form.Item label="Full Name">
              <Input
                value={kycData.legalRepName}
                onChange={(e) => updateKycField('legalRepName', e.target.value)}
                placeholder="Legal representative full name"
              />
            </Form.Item>
            <Form.Item label="ID Type">
              <Select
                value={kycData.legalRepIdType || undefined}
                onChange={(val) => updateKycField('legalRepIdType', val)}
                placeholder="Select ID type"
                options={ID_TYPE_OPTIONS}
                allowClear
              />
            </Form.Item>
            <Form.Item label="ID Number">
              <Input
                value={kycData.legalRepIdNo}
                onChange={(e) => updateKycField('legalRepIdNo', e.target.value)}
                placeholder="ID document number"
              />
            </Form.Item>
            <Form.Item label="Date of Birth">
              <Input
                value={kycData.legalRepDob}
                onChange={(e) => updateKycField('legalRepDob', e.target.value)}
                placeholder="YYYY-MM-DD"
              />
            </Form.Item>

            <Divider />
            <Title level={5}>Directors / UBOs (Entity Associations)</Title>
            {kycData.entityAssociations.map((assoc, idx) => (
              <Card
                key={idx}
                size="small"
                title={`${assoc.associationType || 'Director'} #${idx + 1}`}
                extra={<Button type="text" danger onClick={() => removeAssociation(idx)}>Remove</Button>}
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
                    <Input 
                      value={assoc.fullName} 
                      onChange={(e) => updateAssociation(idx, 'fullName', e.target.value)} 
                      placeholder="Full name" 
                    />
                  </Form.Item>
                  <Form.Item label="First Name" style={{ marginBottom: 8 }}>
                    <Input 
                      value={assoc.firstName} 
                      onChange={(e) => updateAssociation(idx, 'firstName', e.target.value)} 
                      placeholder="First name" 
                    />
                  </Form.Item>
                  <Form.Item label="Last Name" style={{ marginBottom: 8 }}>
                    <Input 
                      value={assoc.lastName} 
                      onChange={(e) => updateAssociation(idx, 'lastName', e.target.value)} 
                      placeholder="Last name" 
                    />
                  </Form.Item>
                  <Form.Item label="Date of Birth" style={{ marginBottom: 8 }}>
                    <Input 
                      value={assoc.dateOfBirth} 
                      onChange={(e) => updateAssociation(idx, 'dateOfBirth', e.target.value)} 
                      placeholder="YYYY-MM-DD" 
                    />
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
                    <Input 
                      value={assoc.idNo} 
                      onChange={(e) => updateAssociation(idx, 'idNo', e.target.value)} 
                      placeholder="ID number" 
                    />
                  </Form.Item>
                  {assoc.associationType === 'UBO' && (
                    <Form.Item label="Shareholding Ratio (%)" style={{ marginBottom: 8 }}>
                      <Input 
                        value={assoc.shareholdingRatio} 
                        onChange={(e) => updateAssociation(idx, 'shareholdingRatio', e.target.value)} 
                        placeholder="e.g. 33.5" 
                      />
                    </Form.Item>
                  )}
                </Space>
              </Card>
            ))}
            <Button type="dashed" block onClick={addAssociation} style={{ marginBottom: 24 }}>
              Add Director / UBO
            </Button>

            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={() => setPhase('question')}>
                Back
              </Button>
              <Button 
                type="primary" 
                loading={submitting}
                onClick={handleSubmit}
                disabled={!kycData.legalName || !kycData.companyType || !kycData.certificateNo}
              >
                Submit Application
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    );
  }

  // Phase: Submitting
  if (phase === 'submitting') {
    return (
      <div>
        <Title level={3} style={{ marginBottom: 24 }}>Set up Shopify Payments</Title>
        <Card style={{ maxWidth: 600, textAlign: 'center', padding: 48 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
          <Title level={4} style={{ marginTop: 24 }}>Submitting your application...</Title>
          <Paragraph type="secondary">
            Please wait while we process your merchant registration.
          </Paragraph>
        </Card>
      </div>
    );
  }

  // Phase: Done
  if (phase === 'done') {
    return (
      <Result
        status="success"
        title="Shopify Payments Setup Complete"
        subTitle="Your merchant registration has been submitted. You will receive notifications as the KYC review progresses."
        extra={[
          <Button type="primary" key="detail" onClick={() => navigate(`/merchants/${id}`)}>
            View Merchant Detail
          </Button>,
          <Button key="home" onClick={() => navigate('/')}>
            Back to Home
          </Button>,
        ]}
      />
    );
  }

  // Phase: Error
  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Set up Shopify Payments</Title>
      <Card style={{ maxWidth: 600 }}>
        <Alert
          type="error"
          message="Setup Failed"
          description={errorMessage}
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Button type="primary" onClick={() => {
          setPhase('question');
          setErrorMessage('');
        }}>
          Try Again
        </Button>
      </Card>
    </div>
  );
}
