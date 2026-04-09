import { useState } from 'react';
import { Layout, Menu, Dropdown, Typography, Modal, Form, Input, Select, message } from 'antd';
import type { DropdownProps } from 'antd';
import {
  HomeOutlined,
  ShopOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { merchantApi } from '../../services/merchantApi';
import { KycStatusTag } from '../StatusTags';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: 'Home' },
  { key: '/merchant', icon: <ShopOutlined />, label: 'Merchant' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { config, merchants, currentMerchant, setCurrentMerchant, refreshMerchants } = useAppContext();
  const [newStoreModalOpen, setNewStoreModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const selectedKey = (() => {
    if (location.pathname === '/') return '/';
    if (location.pathname.startsWith('/merchant')) return '/merchant';
    return '/';
  })();

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '/merchant') {
      // Navigate to current merchant detail page
      if (currentMerchant) {
        navigate(`/merchants/${currentMerchant.id}`);
      } else {
        message.warning('Please select a store first from the dropdown above.');
      }
    } else {
      navigate(key);
    }
  };

  const handleCreateStore = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      const res = await merchantApi.create({
        shopName: values.shopName,
        email: values.email,
        region: values.region || 'CN',
      });
      message.success('Store created successfully!');
      await refreshMerchants();
      setCurrentMerchant(res.data);
      setNewStoreModalOpen(false);
      form.resetFields();
      navigate('/');
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      console.error('Create store error:', err);
      message.error('Failed to create store');
    } finally {
      setCreating(false);
    }
  };

  // 构建店铺切换下拉菜单
  const storeMenuItems = [
    ...merchants.map((merchant) => ({
      key: merchant.id,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 200, gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {merchant.shopName}
            {currentMerchant?.id === merchant.id && (
              <span style={{ color: '#52c41a' }}>✓</span>
            )}
          </span>
          <KycStatusTag status={merchant.kycStatus} />
        </div>
      ),
      onClick: () => setCurrentMerchant(merchant),
    })),
    { type: 'divider' as const },
    {
      key: 'new-store',
      icon: <PlusOutlined />,
      label: <Text strong>Add New Store</Text>,
      onClick: () => setNewStoreModalOpen(true),
    },
  ];

  const storeDropdownProps: DropdownProps = {
    menu: { items: storeMenuItems },
    trigger: ['click'],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          Mini-Shopify
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 16,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {/* 店铺切换下拉菜单 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dropdown {...storeDropdownProps}>
              <div
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 12px',
                  borderRadius: 4,
                  border: '1px solid #d9d9d9',
                  transition: 'all 0.3s',
                }}
              >
                <ShopOutlined />
                <Text>
                  {currentMerchant ? currentMerchant.shopName : 'Select Store'}
                </Text>
              </div>
            </Dropdown>
            {currentMerchant && (
              <KycStatusTag status={currentMerchant.kycStatus} />
            )}
          </div>

          {/* Mock Mode 标识 */}
          {config && (
            <span
              style={{
                padding: '2px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                background: config.mockMode ? '#e6f7ff' : '#fff7e6',
                color: config.mockMode ? '#1890ff' : '#fa8c16',
                border: `1px solid ${config.mockMode ? '#91d5ff' : '#ffd591'}`,
              }}
            >
              {config.mockMode ? 'MOCK MODE' : 'PRODUCTION'}
            </span>
          )}
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>

      <Modal
        title="Create New Store"
        open={newStoreModalOpen}
        onOk={handleCreateStore}
        onCancel={() => { setNewStoreModalOpen(false); form.resetFields(); }}
        confirmLoading={creating}
        okText="Create Store"
      >
        <Form form={form} layout="vertical" initialValues={{ region: 'CN' }}>
          <Form.Item name="shopName" label="Shop Name" rules={[{ required: true, message: 'Please enter a shop name' }]}>
            <Input placeholder="Enter your shop name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Please enter an email' }, { type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="merchant@example.com" />
          </Form.Item>
          <Form.Item name="region" label="Region">
            <Select>
              <Select.Option value="CN">China (CN)</Select.Option>
              <Select.Option value="US">United States (US)</Select.Option>
              <Select.Option value="SG">Singapore (SG)</Select.Option>
              <Select.Option value="HK">Hong Kong (HK)</Select.Option>
              <Select.Option value="JP">Japan (JP)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
