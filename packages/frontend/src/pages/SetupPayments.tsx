import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Button, Modal, Steps, Result, Spin, Alert, message } from 'antd';
import { UserSwitchOutlined, UserAddOutlined, LoadingOutlined } from '@ant-design/icons';
import { merchantApi } from '../services/merchantApi';

const { Title, Paragraph } = Typography;

const WF_SIGNUP_URL = 'https://www.worldfirst.com/uk/?utm_medium=cpc&utm_source=google&utm_campaign=CPC_google_monks_us_brand_worldfirst&utm_term=CPC_US_Brand_worldfirst&utm_content=[WorldFirst]&utm_date=295279591102&gad_so';

type SetupPhase = 'wf-login' | 'processing' | 'done' | 'error';

interface ProcessingStep {
  title: string;
  status: 'wait' | 'process' | 'finish' | 'error';
}

export default function SetupPayments() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<SetupPhase>('wf-login');
  const [modalOpen, setModalOpen] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { title: 'Logging in to WorldFirst', status: 'wait' },
    { title: 'Querying KYB information from Antom', status: 'wait' },
    { title: 'Filling KYB data & registering merchant', status: 'wait' },
  ]);
  const [errorMessage, setErrorMessage] = useState('');

  const updateStep = useCallback((index: number, status: ProcessingStep['status']) => {
    setProcessingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, status } : s)));
  }, []);

  const handleSetup = useCallback(async (wfAccountId: string, accessToken: string, customerId: string) => {
    if (!id) return;

    setPhase('processing');

    // Step 1: WF Login complete
    updateStep(0, 'finish');

    // Step 2: Query KYB from Antom
    updateStep(1, 'process');
    try {
      const result = await merchantApi.setupPayments(id, {
        wfAccountId,
        accessToken,
        customerId,
      });

      if (result.data.success) {
        updateStep(1, 'finish');
        updateStep(2, 'finish');
        setPhase('done');
        message.success('Shopify Payments setup complete!');
      } else {
        // API returned 2xx but success=false (shouldn't normally happen)
        updateStep(1, 'error');
        setErrorMessage(result.data.error || 'Failed to setup payments');
        setPhase('error');
      }
    } catch (err: unknown) {
      console.error('Setup payments error:', err);

      // Extract error details from the response
      const axiosErr = err as { response?: { data?: { failedStep?: string; error?: string } } };
      const failedStep = axiosErr?.response?.data?.failedStep;
      const errorMsg = axiosErr?.response?.data?.error || 'Failed to setup payments. Please try again.';

      if (failedStep === 'register') {
        // KYB query succeeded, registration failed
        updateStep(1, 'finish');
        updateStep(2, 'error');
      } else {
        // KYB query failed or unknown error
        updateStep(1, 'error');
      }

      setErrorMessage(errorMsg);
      setPhase('error');
    }
  }, [id, updateStep]);

  // Listen for WF Login postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'WF_LOGIN_SUCCESS') {
        const { wfAccountId, accessToken, customerId } = event.data;
        setModalOpen(false);
        handleSetup(wfAccountId, accessToken, customerId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleSetup]);

  const handleSignUp = () => {
    window.open(WF_SIGNUP_URL, '_blank');
  };

  const currentStep = processingSteps.findIndex((s) => s.status === 'process');

  // Phase: WF Login / Sign Up
  if (phase === 'wf-login') {
    return (
      <div>
        <Title level={3} style={{ marginBottom: 24 }}>Set up Shopify Payments</Title>
        <Card style={{ maxWidth: 600 }}>
          <Paragraph>
            Connect your WorldFirst account to enable Shopify Payments. Your KYB information will be
            shared securely to complete merchant registration.
          </Paragraph>

          <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Button
              type="primary"
              icon={<UserSwitchOutlined />}
              size="large"
              onClick={() => setModalOpen(true)}
            >
              Login with WorldFirst
            </Button>
            <Button
              icon={<UserAddOutlined />}
              size="large"
              onClick={handleSignUp}
            >
              Sign Up for WorldFirst
            </Button>
          </div>

          <Paragraph type="secondary" style={{ marginTop: 16 }}>
            Choose Login if you already have a WorldFirst account, or Sign Up to create a new one.
            After signing up, come back and log in to continue.
          </Paragraph>

          <Modal
            title="WorldFirst Authorization"
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            footer={null}
            width={500}
            destroyOnClose
          >
            <iframe
              src="/api/wf/login"
              style={{ width: '100%', height: 450, border: 'none', borderRadius: 8 }}
              title="WorldFirst Login"
            />
          </Modal>
        </Card>
      </div>
    );
  }

  // Phase: Processing
  if (phase === 'processing') {
    return (
      <div>
        <Title level={3} style={{ marginBottom: 24 }}>Setting up Shopify Payments</Title>
        <Card style={{ maxWidth: 600 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} style={{ marginBottom: 24 }}>
            <div style={{ padding: 24 }} />
          </Spin>
          <Steps
            direction="vertical"
            current={currentStep >= 0 ? currentStep : processingSteps.length}
            items={processingSteps.map((s) => ({
              title: s.title,
              status: s.status,
            }))}
            style={{ marginTop: 16 }}
          />
          <Paragraph type="secondary" style={{ marginTop: 16 }}>
            Please wait while we set up your payment processing...
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
        <Steps
          direction="vertical"
          items={processingSteps.map((s) => ({
            title: s.title,
            status: s.status,
          }))}
          style={{ marginBottom: 24 }}
        />
        <Button type="primary" onClick={() => {
          setPhase('wf-login');
          setProcessingSteps([
            { title: 'Logging in to WorldFirst', status: 'wait' },
            { title: 'Querying KYB information from Antom', status: 'wait' },
            { title: 'Filling KYB data & registering merchant', status: 'wait' },
          ]);
          setErrorMessage('');
        }}>
          Try Again
        </Button>
      </Card>
    </div>
  );
}
