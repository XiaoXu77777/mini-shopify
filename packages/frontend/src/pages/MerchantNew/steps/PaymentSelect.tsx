import { Checkbox, Typography } from 'antd';
import { PAYMENT_METHOD_OPTIONS } from '../../../utils/constants';
import type { WizardData } from '../index';

const { Paragraph } = Typography;

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export default function PaymentSelectStep({ data, onChange }: Props) {
  return (
    <div style={{ maxWidth: 500 }}>
      <Paragraph>Select the payment methods you want to activate for your shop:</Paragraph>
      <Checkbox.Group
        options={PAYMENT_METHOD_OPTIONS}
        value={data.paymentMethodTypes}
        onChange={(vals) => onChange({ paymentMethodTypes: vals as string[] })}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      />
      {data.paymentMethodTypes.length === 0 && (
        <Paragraph type="danger" style={{ marginTop: 12 }}>
          Please select at least one payment method.
        </Paragraph>
      )}
    </div>
  );
}
