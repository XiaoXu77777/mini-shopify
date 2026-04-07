import { Router, Request, Response } from 'express';
import { signatureVerify } from '../middleware/signatureVerify';
import { notifyService } from '../services/notifyService';
import type { AntomNotification } from '../types';

const router = Router();

// POST /api/notify/register - Receive Antom async notification (guide section 4.3)
router.post('/register', signatureVerify, async (req: Request, res: Response) => {
  try {
    const notification = req.body as AntomNotification;

    // Validate required fields: notifyId + (notificationType or notifyType)
    const notificationType = notification.notificationType || notification.notifyType;
    if (!notification.notifyId || !notificationType) {
      // Per guide: still return success format even on error
      res.status(400).json({
        result: { resultCode: 'INVALID_PARAM', resultValue: 'F', message: 'Missing required fields' },
      });
      return;
    }

    await notifyService.processNotification(notification);

    // Return fixed response per guide section 4.3
    res.json({
      result: { resultCode: 'SUCCESS', resultValue: 'S', message: 'success' },
    });
  } catch (err) {
    console.error('[Notify] Error processing notification:', err);
    res.status(500).json({
      result: { resultCode: 'ERROR', resultValue: 'F', message: 'Internal error' },
    });
  }
});

export default router;
