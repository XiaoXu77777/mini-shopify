"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signatureVerify = signatureVerify;
const config_1 = require("../utils/config");
const crypto_1 = require("../utils/crypto");
/**
 * Middleware to verify Antom notification signatures.
 * In mock mode, signature verification is skipped.
 */
function signatureVerify(req, res, next) {
    console.log(`[SignatureVerify] Incoming ${req.method} ${req.originalUrl}`);
    console.log(`[SignatureVerify] Headers: client-id=${req.headers['client-id'] || '(missing)'}, request-time=${req.headers['request-time'] || '(missing)'}, signature=${req.headers['signature'] ? '(present)' : '(missing)'}`);
    if (config_1.config.mockMode) {
        console.log('[SignatureVerify] Mock mode enabled, skipping verification');
        return next();
    }
    try {
        const clientId = req.headers['client-id'];
        const requestTime = req.headers['request-time'];
        const signatureHeader = req.headers['signature'];
        if (!clientId || !requestTime || !signatureHeader) {
            console.warn(`[SignatureVerify] Missing headers - client-id: ${!!clientId}, request-time: ${!!requestTime}, signature: ${!!signatureHeader}`);
            res.status(401).json({ error: 'Missing signature headers' });
            return;
        }
        const parsed = (0, crypto_1.parseSignatureHeader)(signatureHeader);
        if (!parsed) {
            console.warn(`[SignatureVerify] Failed to parse signature header: ${signatureHeader}`);
            res.status(401).json({ error: 'Invalid signature header format' });
            return;
        }
        // Use raw body for verification - must NOT re-serialize JSON
        const rawBody = req.rawBody;
        if (!rawBody) {
            console.warn('[SignatureVerify] rawBody is empty - check express.json() verify config');
            res.status(401).json({ error: 'Missing raw body for signature verification' });
            return;
        }
        // httpUri: Use the request path without query string.
        // Per Antom docs, this should match the path Antom uses when signing the notification.
        // req.originalUrl includes the full mounted path (e.g. /api/notify/register) which is
        // what Antom signs against (the path portion of the notifyUrl you registered).
        const httpUri = req.originalUrl.split('?')[0];
        console.log(`[SignatureVerify] Verifying signature - httpUri: ${httpUri}, clientId: ${clientId}, requestTime: ${requestTime}, bodyLength: ${rawBody.length}`);
        console.log(`[SignatureVerify] DEBUG - rawBody (first 500 chars): ${rawBody.substring(0, 500)}`);
        console.log(`[SignatureVerify] DEBUG - parsed signature header: algorithm=${parsed.algorithm}, keyVersion=${parsed.keyVersion}, signature(first 50)=${parsed.signature.substring(0, 50)}...`);
        console.log(`[SignatureVerify] DEBUG - publicKey configured: ${config_1.config.antom.publicKey ? `YES (length=${config_1.config.antom.publicKey.length}, first 30=${config_1.config.antom.publicKey.substring(0, 30)}...)` : 'NO (empty)'}`);
        const isValid = (0, crypto_1.verifySignature)(httpUri, clientId, requestTime, rawBody, parsed.signature, config_1.config.antom.publicKey);
        if (!isValid) {
            console.warn(`[SignatureVerify] Signature verification FAILED for ${httpUri}`);
            console.warn(`[SignatureVerify] DEBUG - contentToVerify would be: "POST ${httpUri}\\n${clientId}.${requestTime}.${rawBody.substring(0, 200)}..."`);
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }
        console.log('[SignatureVerify] Signature verified OK, proceeding to handler');
        next();
    }
    catch (err) {
        console.error('[SignatureVerify] Error:', err);
        res.status(401).json({ error: 'Signature verification failed' });
    }
}
//# sourceMappingURL=signatureVerify.js.map