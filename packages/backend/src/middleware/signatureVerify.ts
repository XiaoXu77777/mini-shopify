import { Request, Response, NextFunction } from 'express';
import { config } from '../utils/config';
import { parseSignatureHeader, verifySignature } from '../utils/crypto';

/**
 * Middleware to verify Antom notification signatures.
 * In mock mode, signature verification is skipped.
 */
export function signatureVerify(req: Request, res: Response, next: NextFunction) {
  console.log(`[SignatureVerify] Incoming ${req.method} ${req.originalUrl}`);
  console.log(`[SignatureVerify] Headers: client-id=${req.headers['client-id'] || '(missing)'}, request-time=${req.headers['request-time'] || '(missing)'}, signature=${req.headers['signature'] ? '(present)' : '(missing)'}`);

  if (config.mockMode) {
    console.log('[SignatureVerify] Mock mode enabled, skipping verification');
    return next();
  }

  try {
    const clientId = req.headers['client-id'] as string;
    const requestTime = req.headers['request-time'] as string;
    const signatureHeader = req.headers['signature'] as string;

    if (!clientId || !requestTime || !signatureHeader) {
      console.warn(`[SignatureVerify] Missing headers - client-id: ${!!clientId}, request-time: ${!!requestTime}, signature: ${!!signatureHeader}`);
      res.status(401).json({ error: 'Missing signature headers' });
      return;
    }

    const parsed = parseSignatureHeader(signatureHeader);
    if (!parsed) {
      console.warn(`[SignatureVerify] Failed to parse signature header: ${signatureHeader}`);
      res.status(401).json({ error: 'Invalid signature header format' });
      return;
    }

    // Use raw body for verification - must NOT re-serialize JSON
    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
      console.warn('[SignatureVerify] rawBody is empty - check express.json() verify config');
      res.status(401).json({ error: 'Missing raw body for signature verification' });
      return;
    }

    const httpUri = req.originalUrl;
    console.log(`[SignatureVerify] Verifying signature - httpUri: ${httpUri}, clientId: ${clientId}, requestTime: ${requestTime}, bodyLength: ${rawBody.length}`);

    const isValid = verifySignature(
      httpUri,
      clientId,
      requestTime,
      rawBody,
      parsed.signature,
      config.antom.publicKey
    );

    if (!isValid) {
      console.warn(`[SignatureVerify] Signature verification FAILED for ${httpUri}`);
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    console.log('[SignatureVerify] Signature verified OK, proceeding to handler');
    next();
  } catch (err) {
    console.error('[SignatureVerify] Error:', err);
    res.status(401).json({ error: 'Signature verification failed' });
  }
}
