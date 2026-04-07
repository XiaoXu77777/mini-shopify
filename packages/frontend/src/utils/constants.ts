export const PAYMENT_METHOD_OPTIONS = [
  { label: 'Visa', value: 'Visa' },
  { label: 'Mastercard', value: 'Mastercard' },
  { label: 'Discover', value: 'Discover' },
  { label: 'JCB', value: 'JCB' },
  { label: 'Diners', value: 'Diners' },
  { label: 'GooglePay', value: 'GooglePay' },
  { label: 'ApplePay', value: 'ApplePay' },
  { label: 'AlipayHK', value: 'AlipayHK' },
  { label: 'Naver Pay', value: 'Naver Pay' },
  { label: 'Kakao Pay', value: 'Kakao Pay' },
  { label: 'Toss Pay', value: 'Toss Pay' },
  { label: 'PayNow', value: 'PayNow' },
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
