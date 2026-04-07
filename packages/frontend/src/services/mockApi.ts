import api from './api';

export const mockApi = {
  triggerNotification(data: {
    merchantId: string;
    notificationType: string;
    data: Record<string, unknown>;
  }) {
    return api.post<{ success: boolean; notifyId: string }>('/mock/notify', data);
  },
};
