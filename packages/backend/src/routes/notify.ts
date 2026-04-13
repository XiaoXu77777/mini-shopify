import { Router, Request, Response } from 'express';
import { signatureVerify } from '../middleware/signatureVerify';
import { notifyService } from '../services/notifyService';
import type { AntomNotification } from '../types';

const router = Router();

// POST /api/notify/register - Receive Antom async notification (guide section 4.3)
router.post('/register', signatureVerify, async (req: Request, res: Response) => {
  try {
    const notification = req.body as AntomNotification;
    console.log('[Notify] Antom callback <<< received notification:', JSON.stringify(notification, null, 2));

    // Validate required fields: notificationType or notifyType
    const notificationType = notification.notificationType || notification.notifyType;
    if (!notificationType) {
      // Per guide: still return success format even on error
      const errorResponse = {
        result: { resultCode: 'INVALID_PARAM', resultValue: 'F', message: 'Missing notificationType' },
      };
      console.log('[Notify] Antom callback >>> response (invalid):', JSON.stringify(errorResponse, null, 2));
      res.status(400).json(errorResponse);
      return;
    }

    await notifyService.processNotification(notification);

    // Return fixed response per guide section 4.3
    const successResponse = {
      result: { resultCode: 'SUCCESS', resultValue: 'S', message: 'success' },
    };
    console.log('[Notify] Antom callback >>> response:', JSON.stringify(successResponse, null, 2));
    res.json(successResponse);
  } catch (err) {
    console.error('[Notify] Error processing notification:', err);
    res.status(500).json({
      result: { resultCode: 'ERROR', resultValue: 'F', message: 'Internal error' },
    });
  }
});

export default router;
