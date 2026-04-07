import { Router, Request, Response } from 'express';
import { mockService } from '../services/mockService';
import { NotificationType } from '../types';

const router = Router();

// POST /api/mock/notify - Manually trigger a mock notification
router.post('/notify', async (req: Request, res: Response) => {
  try {
    const { merchantId, notificationType, data } = req.body;

    if (!merchantId || !notificationType) {
      res.status(400).json({ error: 'merchantId and notificationType are required' });
      return;
    }

    const validTypes: NotificationType[] = [
      'REGISTRATION_STATUS',
      'PAYMENT_METHOD_ACTIVATION_STATUS',
      'RISK_NOTIFICATION',
    ];
    if (!validTypes.includes(notificationType)) {
      res.status(400).json({ error: `notificationType must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const notifyId = await mockService.triggerNotification(merchantId, notificationType, data || {});
    res.json({ success: true, notifyId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Mock] Trigger error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
