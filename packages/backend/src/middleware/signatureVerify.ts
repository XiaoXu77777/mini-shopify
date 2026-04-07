import { Request, Response, NextFunction } from 'express';
import { config } from '../utils/config';
import { parseSignatureHeader, verifySignature } from '../utils/crypto';

/**
 * Middleware to verify Antom notification signatures.
 * In mock mode, signature verification is skipped.
 */
export function signatureVerify(req: Request, res: Response, next: NextFunction) {
  if (config.mockMode) {
    return next();
  }

  try {
    const clientId = req.headers['client-id'] as string;
    const requestTime = req.headers['request-time'] as string;
    const signatureHeader = req.headers['signature'] as string;

    if (!clientId || !requestTime || !signatureHeader) {
      res.status(401).json({ error: 'Missing signature headers' });
      return;
    }

    const parsed = parseSignatureHeader(signatureHeader);
    if (!parsed) {
      res.status(401).json({ error: 'Invalid signature header format' });
      return;
    }

    // Use raw body for verification - must NOT re-serialize JSON
    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
      res.status(401).json({ error: 'Missing raw body for signature verification' });
      return;
    }

    const httpUri = req.originalUrl;
    const isValid = verifySignature(
      httpUri,
      clientId,
      requestTime,
      rawBody,
      parsed.signature,
      config.antom.publicKey
    );

    if (!isValid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    next();
  } catch (err) {
    console.error('[SignatureVerify] Error:', err);
    res.status(401).json({ error: 'Signature verification failed' });
  }
}
