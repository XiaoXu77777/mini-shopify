export const PAYMENT_METHOD_OPTIONS = [
  { label: 'Visa', value: 'VISA' },
  { label: 'Mastercard', value: 'MASTERCARD' },
  { label: 'Discover', value: 'DISCOVER' },
  { label: 'JCB', value: 'JCB' },
  { label: 'Diners', value: 'DINERS' },
  { label: 'Google Pay', value: 'GOOGLEPAY' },
  { label: 'Apple Pay', value: 'APPLEPAY' },
  { label: 'AlipayHK', value: 'ALIPAY_HK' },
  { label: 'NAVER Pay', value: 'NAVER_PAY' },
  { label: 'Kakao Pay', value: 'KAKAO_PAY' },
  { label: 'Toss Pay', value: 'TOSS_PAY' },
  { label: 'PayNow', value: 'PAYNOW' },
];

export const ALL_PAYMENT_METHOD_TYPES = PAYMENT_METHOD_OPTIONS.map((o) => o.value);

export const KYC_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'default', label: 'Pending' },
  APPROVED: { color: 'success', label: 'Approved' },
  REJECTED: { color: 'error', label: 'Rejected' },
  SUPPLEMENT_REQUIRED: { color: 'warning', label: 'Supplement Required' },
};

export const MERCHANT_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'success', label: 'Active' },
  INACTIVE: { color: 'warning', label: 'Inactive' },
  OFFBOARDED: { color: 'default', label: 'Offboarded' },
};

export const PM_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'processing', label: 'Pending' },
  ACTIVE: { color: 'success', label: 'Active' },
  INACTIVE: { color: 'default', label: 'Inactive' },
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  REGISTRATION_STATUS: 'Registration Status',
  PAYMENT_METHOD_ACTIVATION_STATUS: 'Payment Method Activation',
  RISK_NOTIFICATION: 'Risk Notification',
};
