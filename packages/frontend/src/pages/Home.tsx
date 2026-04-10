import { Row, Col, Card, Typography, Button, message } from 'antd';
import {
  ShoppingCartOutlined,
  ShopOutlined,
  CreditCardOutlined,
  GlobalOutlined,
  TruckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { merchantApi } from '../services/merchantApi';

const { Title, Text } = Typography;

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
}

function ActionCard({ icon, title, description, buttonText, onClick }: ActionCardProps) {
  return (
    <Card
      hoverable
      style={{ height: '100%' }}
      bodyStyle={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ fontSize: 32, marginBottom: 16, color: '#1890ff' }}>{icon}</div>
      <Title level={5} style={{ marginBottom: 8 }}>{title}</Title>
      <Text type="secondary" style={{ flex: 1, marginBottom: 16 }}>{description}</Text>
      <Button type="primary" onClick={onClick}>{buttonText}</Button>
    </Card>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { currentMerchant } = useAppContext();

  const handleSetupPayments = async () => {
    if (!currentMerchant) {
      message.warning('Please select a store first from the dropdown above, or create a new store.');
      return;
    }
    try {
      // Fetch latest merchant data from backend to check registration status
      const res = await merchantApi.getById(currentMerchant.id);
      const latestMerchant = res.data;
      if (latestMerchant.registrationRequestId) {
        // Already submitted, go to merchant detail
        navigate(`/merchants/${currentMerchant.id}`);
      } else {
        navigate(`/merchants/${currentMerchant.id}/setup-payments`);
      }
    } catch {
      // Fallback: use cached data
      if (currentMerchant.registrationRequestId) {
        navigate(`/merchants/${currentMerchant.id}`);
      } else {
        navigate(`/merchants/${currentMerchant.id}/setup-payments`);
      }
    }
  };

  const cardData = [
    // 第一行
    {
      icon: <ShoppingCartOutlined />,
      title: 'Add Product',
      description: 'Upload your product catalog and start selling online.',
      buttonText: 'Add Product',
      onClick: () => console.log('Add Product clicked'),
    },
    {
      icon: <ShopOutlined />,
      title: 'Customize Your Store',
      description: 'Choose a theme and customize your online store design.',
      buttonText: 'Customize Store',
      onClick: () => console.log('Customize Store clicked'),
    },
    // 第二行
    {
      icon: <CreditCardOutlined />,
      title: 'Set up Shopify Payments',
      description: 'Enable payment processing to accept credit cards and other payment methods.',
      buttonText: 'Set Up Payments',
      onClick: handleSetupPayments,
    },
    {
      icon: <TruckOutlined />,
      title: 'Review Your Shipping Rates',
      description: 'Set up shipping rates and delivery options for your customers.',
      buttonText: 'Configure Shipping',
      onClick: () => console.log('Shipping clicked'),
    },
    {
      icon: <GlobalOutlined />,
      title: 'Domain Customized',
      description: 'Connect a custom domain or use a free myshopify.com domain.',
      buttonText: 'Manage Domain',
      onClick: () => console.log('Domain clicked'),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ marginBottom: 8 }}>Welcome to Mini-Shopify</Title>
        <Text type="secondary">Manage your store from here. Select a store from the dropdown above or get started with the actions below.</Text>
      </div>

      {/* 第一行：两个卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {cardData.slice(0, 2).map((card, index) => (
          <Col xs={24} md={12} key={index}>
            <ActionCard {...card} />
          </Col>
        ))}
      </Row>

      {/* 第二行：三个卡片 */}
      <Row gutter={[24, 24]}>
        {cardData.slice(2).map((card, index) => (
          <Col xs={24} md={8} key={index + 2}>
            <ActionCard {...card} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
