import { useState, useEffect, useCallback } from 'react';
import { Steps, Button, message, Typography, Card, Result, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { merchantApi } from '../../services/merchantApi';
import { ALL_PAYMENT_METHOD_TYPES } from '../../utils/constants';
import BasicInfoStep from './steps/BasicInfo';
import WfConnectStep from './steps/WfConnect';
import KycFormStep from './steps/KycForm';
import ConfirmStep from './steps/Confirm';

const { Title } = Typography;

export interface WizardEntityAssociation {
  associationType: string;
  shareholdingRatio: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  idType: string;
  idNo: string;
}

export interface WizardData {
  // Step 1 - Basic Info
  shopName: string;
  email: string;
  region: string;
  // Step 2 - WF Account
  wfAccountId: string;
  wfAccessToken?: string;  // WF 登录后的 access token
  wfCustomerId?: string;   // WF customer ID
  wfKycData: Record<string, unknown> | null;
  // Step 3 - KYC Info (Antom-aligned)
  // Company info
  legalName: string;
  companyType: string;
  certificateType: string;
  certificateNo: string;
  branchName: string;
  companyUnit: string;
  // Registered address
  addressRegion: string;
  addressState: string;
  addressCity: string;
  address1: string;
  address2: string;
  zipCode: string;
  // Business info
  mcc: string;
  doingBusinessAs: string;
  websiteUrl: string;
  englishName: string;
  serviceDescription: string;
  appName: string;
  merchantBrandName: string;
  // Contact
  contactType: string;
  contactInfo: string;
  // Legal representative
  legalRepName: string;
  legalRepIdType: string;
  legalRepIdNo: string;
  legalRepDob: string;
  // Entity associations (directors/UBOs)
  entityAssociations: WizardEntityAssociation[];
  // Payment methods (always all)
  paymentMethodTypes: string[];
  // Created merchant id
  merchantId: string;
}

const initialData: WizardData = {
  shopName: '',
  email: '',
  region: 'CN',
  wfAccountId: '',
  wfAccessToken: '',
  wfCustomerId: '',
  wfKycData: null,
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
  paymentMethodTypes: ALL_PAYMENT_METHOD_TYPES,
  merchantId: '',
};

const steps = [
  { title: 'Basic Info' },
  { title: 'Setup Payments' },
  { title: 'KYC Info' },
  { title: 'Confirm & Submit' },
];

export default function MerchantNew() {
  const [current, setCurrent] = useState(0);
  const [data, setData] = useState<WizardData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [kybLoading, setKybLoading] = useState(false);
  const navigate = useNavigate();

  const updateData = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  // Query KYB info from Antom using WF access token
  const fetchKybInfo = useCallback(async (accessToken: string, customerId: string) => {
    setKybLoading(true);
    try {
      const res = await merchantApi.queryWfKybInfo(accessToken, customerId);
      if (res.data.success && res.data.kybData) {
        const kybData = res.data.kybData;
        const kybAny = kybData as Record<string, unknown>;
        
        // Pre-fill KYC fields from KYB data
        updateData({
          wfKycData: kybData,
          // Company info
          legalName: String(kybAny.legalName || ''),
          companyType: String(kybAny.companyType || ''),
          certificateType: String(kybAny.certificateType || ''),
          certificateNo: String(kybAny.certificateNo || ''),
          branchName: String(kybAny.branchName || ''),
          companyUnit: String(kybAny.companyUnit || ''),
          // Registered address
          addressRegion: String(kybAny.addressRegion || ''),
          addressState: String(kybAny.addressState || ''),
          addressCity: String(kybAny.addressCity || ''),
          address1: String(kybAny.address1 || ''),
          address2: String(kybAny.address2 || ''),
          zipCode: String(kybAny.zipCode || ''),
          // Business info (appName always uses shopName from step 1)
          appName: data.shopName,
          merchantBrandName: String(kybAny.merchantBrandName || ''),
          mcc: String(kybAny.mcc || ''),
          doingBusinessAs: String(kybAny.doingBusinessAs || ''),
          websiteUrl: String(kybAny.websiteUrl || ''),
          englishName: String(kybAny.englishName || ''),
          serviceDescription: String(kybAny.serviceDescription || ''),
          // Contact
          contactType: String(kybAny.contactType || ''),
          contactInfo: String(kybAny.contactInfo || ''),
          // Legal representative
          legalRepName: String(kybAny.legalRepName || ''),
          legalRepIdType: String(kybAny.legalRepIdType || ''),
          legalRepIdNo: String(kybAny.legalRepIdNo || ''),
          legalRepDob: String(kybAny.legalRepDob || ''),
          // Entity associations
          entityAssociations: Array.isArray(kybAny.entityAssociations) 
            ? kybAny.entityAssociations.map((ea: Record<string, unknown>) => ({
                associationType: String(ea.associationType || 'DIRECTOR'),
                shareholdingRatio: String(ea.shareholdingRatio || ''),
                fullName: String(ea.fullName || ''),
                firstName: String(ea.firstName || ''),
                lastName: String(ea.lastName || ''),
                dateOfBirth: String(ea.dateOfBirth || ''),
                idType: String(ea.idType || ''),
                idNo: String(ea.idNo || ''),
              }))
            : [],
        });
        message.success('KYB information loaded successfully!');
      } else {
        message.error(res.data.error || 'Failed to load KYB information');
      }
    } catch (err) {
      console.error('Query KYB error:', err);
      message.error('Failed to query KYB information');
    } finally {
      setKybLoading(false);
    }
  }, [updateData]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Step 1: Create merchant
      const createRes = await merchantApi.create({
        shopName: data.shopName,
        email: data.email,
        region: data.region,
      });
      const merchantId = createRes.data.id;

      // Step 2: Update WF account if connected
      if (data.wfAccountId) {
        await merchantApi.updateWfAccount(merchantId, data.wfAccountId);
      }

      // Step 3: Submit KYC
      await merchantApi.submitKyc(merchantId, {
        legalName: data.legalName,
        companyType: data.companyType,
        certificateType: data.certificateType,
        certificateNo: data.certificateNo,
        branchName: data.branchName,
        companyUnit: data.companyUnit,
        addressRegion: data.addressRegion,
        addressState: data.addressState,
        addressCity: data.addressCity,
        address1: data.address1,
        address2: data.address2,
        zipCode: data.zipCode,
        mcc: data.mcc,
        doingBusinessAs: data.doingBusinessAs,
        websiteUrl: data.websiteUrl,
        englishName: data.englishName,
        serviceDescription: data.serviceDescription,
        appName: data.appName,
        merchantBrandName: data.merchantBrandName,
        contactType: data.contactType,
        contactInfo: data.contactInfo,
        legalRepName: data.legalRepName,
        legalRepIdType: data.legalRepIdType,
        legalRepIdNo: data.legalRepIdNo,
        legalRepDob: data.legalRepDob,
        wfKycData: data.wfKycData,
      });

      // Step 3b: Submit entity associations (directors/UBOs)
      if (data.entityAssociations.length > 0) {
        await merchantApi.updateEntityAssociations(merchantId, data.entityAssociations);
      }

      // Step 4: Register with all payment methods
      await merchantApi.register(merchantId, data.paymentMethodTypes);

      updateData({ merchantId });
      setSubmitted(true);
      message.success('Registration submitted successfully!');
    } catch (err) {
      console.error('Submit error:', err);
      message.error('Failed to submit registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Listen for WF Login postMessage (returns accessToken and customerId)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Handle WF login success - get access token and customer ID
      if (event.data?.type === 'WF_LOGIN_SUCCESS') {
        const { wfAccountId, accessToken, customerId } = event.data;
        updateData({
          wfAccountId,
          wfAccessToken: accessToken,
          wfCustomerId: customerId,
        });
        message.success('WorldFirst account connected! Loading KYB information...');
        // Automatically fetch KYB info after login
        if (accessToken && customerId) {
          fetchKybInfo(accessToken, customerId);
        }
      }
      
      // Legacy: Handle old WF_AUTH_SUCCESS (direct KYC data)
      if (event.data?.type === 'WF_AUTH_SUCCESS') {
        const { wfAccountId, kycData } = event.data;
        updateData({
          wfAccountId,
          wfKycData: kycData,
          // Pre-fill KYC fields from WF data
          legalName: kycData?.legalName || data.legalName,
          companyType: kycData?.companyType || data.companyType,
          certificateType: kycData?.certificateType || data.certificateType,
          certificateNo: kycData?.certificateNo || data.certificateNo,
          branchName: kycData?.branchName || data.branchName,
          companyUnit: kycData?.companyUnit || data.companyUnit,
          addressRegion: kycData?.addressRegion || data.addressRegion,
          addressState: kycData?.addressState || data.addressState,
          addressCity: kycData?.addressCity || data.addressCity,
          address1: kycData?.address1 || data.address1,
          address2: kycData?.address2 ?? data.address2,
          zipCode: kycData?.zipCode || data.zipCode,
          appName: data.shopName,
          merchantBrandName: kycData?.merchantBrandName || data.merchantBrandName,
          mcc: kycData?.mcc || data.mcc,
          doingBusinessAs: kycData?.doingBusinessAs || data.doingBusinessAs,
          websiteUrl: kycData?.websiteUrl || data.websiteUrl,
          englishName: kycData?.englishName || data.englishName,
          serviceDescription: kycData?.serviceDescription || data.serviceDescription,
          contactType: kycData?.contactType || data.contactType,
          contactInfo: kycData?.contactInfo || data.contactInfo,
          legalRepName: kycData?.legalRepName || data.legalRepName,
          legalRepIdType: kycData?.legalRepIdType || data.legalRepIdType,
          legalRepIdNo: kycData?.legalRepIdNo || data.legalRepIdNo,
          legalRepDob: kycData?.legalRepDob || data.legalRepDob,
        });
        message.success('WF account connected successfully!');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [data, updateData, fetchKybInfo]);

  if (submitted) {
    return (
      <Result
        status="success"
        title="Registration Submitted"
        subTitle="Your merchant registration has been submitted. You will receive notifications as the KYC review progresses."
        extra={[
          <Button type="primary" key="detail" onClick={() => navigate(`/merchants/${data.merchantId}`)}>
            View Merchant Detail
          </Button>,
          <Button key="list" onClick={() => navigate('/merchants')}>
            Back to List
          </Button>,
        ]}
      />
    );
  }

  const canNext = () => {
    switch (current) {
      case 0:
        return !!data.shopName && !!data.email;
      case 1:
        return !!data.wfAccountId && !!data.wfKycData; // WF connect is now required
      case 2:
        return !!data.legalName && !!data.companyType && !!data.certificateNo && !!data.mcc && !!data.doingBusinessAs && !!data.websiteUrl && /^https?:\/\/.+\..+/.test(data.websiteUrl);
      default:
        return true;
    }
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>New Merchant Registration</Title>
      <Card>
        <Steps current={current} items={steps} style={{ marginBottom: 32 }} />

        <Spin spinning={kybLoading} tip="Loading KYB information from WorldFirst...">
          <div style={{ minHeight: 300, marginBottom: 24 }}>
            {current === 0 && <BasicInfoStep data={data} onChange={updateData} />}
            {current === 1 && <WfConnectStep data={data} onChange={updateData} />}
            {current === 2 && <KycFormStep data={data} onChange={updateData} />}
            {current === 3 && <ConfirmStep data={data} />}
          </div>
        </Spin>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button disabled={current === 0} onClick={() => setCurrent(current - 1)}>
            Previous
          </Button>
          <div>
            {current < steps.length - 1 && (
              <Button type="primary" disabled={!canNext() || kybLoading} onClick={() => setCurrent(current + 1)}>
                Next
              </Button>
            )}
            {current === steps.length - 1 && (
              <Button type="primary" loading={submitting} onClick={handleSubmit}>
                Submit Registration
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
