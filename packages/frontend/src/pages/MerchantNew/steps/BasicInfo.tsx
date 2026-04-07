import { Form, Input, Select } from 'antd';
import type { WizardData } from '../index';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export default function BasicInfoStep({ data, onChange }: Props) {
  return (
    <Form layout="vertical" style={{ maxWidth: 500 }}>
      <Form.Item label="Shop Name" required>
        <Input
          value={data.shopName}
          onChange={(e) => onChange({ shopName: e.target.value })}
          placeholder="Enter your shop name"
        />
      </Form.Item>
      <Form.Item label="Email" required>
        <Input
          type="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="merchant@example.com"
        />
      </Form.Item>
      <Form.Item label="Region">
        <Select value={data.region} onChange={(val) => onChange({ region: val })}>
          <Select.Option value="CN">China (CN)</Select.Option>
          <Select.Option value="US">United States (US)</Select.Option>
          <Select.Option value="SG">Singapore (SG)</Select.Option>
          <Select.Option value="HK">Hong Kong (HK)</Select.Option>
          <Select.Option value="JP">Japan (JP)</Select.Option>
        </Select>
      </Form.Item>
    </Form>
  );
}
