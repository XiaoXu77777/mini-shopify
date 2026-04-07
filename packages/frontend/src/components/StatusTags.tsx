import { Tag } from 'antd';
import { KYC_STATUS_CONFIG, MERCHANT_STATUS_CONFIG, PM_STATUS_CONFIG } from '../utils/constants';

export function KycStatusTag({ status }: { status: string }) {
  const cfg = KYC_STATUS_CONFIG[status] || { color: 'default', label: status };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
}

export function MerchantStatusTag({ status }: { status: string }) {
  const cfg = MERCHANT_STATUS_CONFIG[status] || { color: 'default', label: status };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
}

export function PmStatusTag({ status }: { status: string }) {
  const cfg = PM_STATUS_CONFIG[status] || { color: 'default', label: status };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
}
