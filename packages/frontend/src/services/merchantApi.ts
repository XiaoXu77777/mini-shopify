import api from './api';
import type { Merchant, DashboardStats, PaymentMethod, Notification, AppConfig, MockPresets, EntityAssociation } from '../types';

export const merchantApi = {
  create(data: { shopName: string; region?: string; email: string }) {
    return api.post<Merchant>('/merchants', data);
  },

  list() {
    return api.get<{ data: Merchant[] }>('/merchants');
  },

  getById(id: string) {
    return api.get<Merchant>(`/merchants/${id}`);
  },

  getStats(merchantId?: string) {
    const params = merchantId ? `?merchantId=${merchantId}` : '';
    return api.get<DashboardStats>(`/merchants/stats${params}`);
  },

  updateWfAccount(id: string, wfAccountId: string) {
    return api.post(`/merchants/${id}/wf-account`, { wfAccountId });
  },

  submitKyc(id: string, data: Record<string, unknown>) {
    return api.post(`/merchants/${id}/kyc`, data);
  },

  updateEntityAssociations(id: string, associations: Omit<EntityAssociation, 'id' | 'merchantId' | 'createdAt' | 'updatedAt'>[]) {
    return api.post(`/merchants/${id}/entity-associations`, { associations });
  },

  register(id: string, paymentMethodTypes: string[]) {
    return api.post<{ registrationRequestId: string; resultInfo: { resultStatus: string; resultCode: string } }>(
      `/merchants/${id}/register`,
      { paymentMethodTypes }
    );
  },

  inquireRegistrationStatus(id: string) {
    return api.get<{ resultInfo: { resultStatus: string }; registrationResult?: { registrationStatus: string }; merchant?: Merchant }>(
      `/merchants/${id}/registration-status`
    );
  },

  offboard(id: string) {
    return api.post(`/merchants/${id}/offboard`);
  },

  getPaymentMethods(id: string) {
    return api.get<{ data: PaymentMethod[] }>(`/merchants/${id}/payment-methods`);
  },

  deactivatePaymentMethod(merchantId: string, pmId: string) {
    return api.post(`/merchants/${merchantId}/payment-methods/${pmId}/deactivate`);
  },

  getNotifications(id: string) {
    return api.get<{ data: Notification[] }>(`/merchants/${id}/notifications`);
  },

  getConfig() {
    return api.get<AppConfig>('/config');
  },

  updateConfig(data: { mockMode?: boolean; mockNotifyDelayMs?: number; mockPresets?: Partial<MockPresets> }) {
    return api.put<AppConfig>('/config', data);
  },

  // WorldFirst KYB info query
  queryWfKybInfo(accessToken: string, customerId: string) {
    return api.post<{ success: boolean; kybData?: Record<string, unknown>; error?: string }>('/wf/query-kyb', {
      accessToken,
      customerId,
    });
  },

  // Get WorldFirst OAuth URL
  getWfOAuthUrl(merchantId: string) {
    return api.post<{ success: boolean; oauthUrl?: string; error?: string }>('/wf/oauth-url', {
      merchantId,
    });
  },

  // Exchange authCode for accessToken
  exchangeWfToken(authCode: string) {
    return api.post<{ success: boolean; accessToken?: string; customerId?: string; wfAccountId?: string; error?: string }>('/wf/exchange-token', {
      authCode,
    });
  },

  // Combined WF auth + KYB query + KYC fill + register
  setupPayments(merchantId: string, data: {
    wfAccountId: string;
    accessToken: string;
    customerId: string;
    kycOverrides?: Record<string, string>;
  }) {
    return api.post<{ success: boolean; registrationRequestId?: string; failedStep?: string; resultInfo?: { resultStatus: string; resultCode: string }; error?: string }>(
      `/merchants/${merchantId}/setup-payments`,
      data,
      { timeout: 60000 },
    );
  },
};
