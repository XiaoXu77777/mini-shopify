import { useState } from 'react';
import { Button, Alert, Descriptions, Typography, Modal, Divider } from 'antd';
import { CheckCircleOutlined, UserSwitchOutlined, UserAddOutlined } from '@ant-design/icons';
import type { WizardData } from '../index';

const { Paragraph } = Typography;

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

const WF_SIGNUP_URL = 'https://portal.worldfirst.com.cn/register/submit?goto=https%3A%2F%2Fportal.worldfirst.com.cn%2F&productType=E_COMMERCE&progress=rollout&region=CN&type=E_COMMERCE&utm_date=register0114&affiliate_id=12413';

export default function WfConnectStep({ data }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleConnect = () => {
    setModalOpen(true);
  };

  const handleSignUp = () => {
    window.open(WF_SIGNUP_URL, '_blank');
  };

  if (data.wfAccountId && data.wfKycData) {
    return (
      <div style={{ maxWidth: 600 }}>
        <Alert
          message="WorldFirst Account Connected"
          description={`Account ID: ${data.wfAccountId}`}
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
        {data.wfKycData && (
          <Descriptions title="KYB Data from WorldFirst" column={1} size="small" bordered>
            {Object.entries(data.wfKycData).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {String(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Paragraph>
        Set up Shopify Payments with WorldFirst. Connect your WorldFirst account to share KYB information and enable payment processing.
      </Paragraph>
      
      <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Button 
          type="primary" 
          icon={<UserSwitchOutlined />} 
          size="large" 
          onClick={handleConnect}
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

      {!data.wfAccountId && (
        <Paragraph type="secondary" style={{ marginTop: 16 }}>
          Choose Login if you already have a WorldFirst account, or Sign Up to create a new one.
        </Paragraph>
      )}

      {data.wfAccountId && !data.wfKycData && (
        <>
          <Divider />
          <Alert
            message="WorldFirst Account Connected"
            description={`Account ID: ${data.wfAccountId}. You can now authorize to share KYB information.`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </>
      )}

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
    </div>
  );
}
