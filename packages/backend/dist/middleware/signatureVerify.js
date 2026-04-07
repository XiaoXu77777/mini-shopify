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
    if (config_1.config.mockMode) {
        return next();
    }
    try {
        const clientId = req.headers['client-id'];
        const requestTime = req.headers['request-time'];
        const signatureHeader = req.headers['signature'];
        if (!clientId || !requestTime || !signatureHeader) {
            res.status(401).json({ error: 'Missing signature headers' });
            return;
        }
        const parsed = (0, crypto_1.parseSignatureHeader)(signatureHeader);
        if (!parsed) {
            res.status(401).json({ error: 'Invalid signature header format' });
            return;
        }
        // Use raw body for verification - must NOT re-serialize JSON
        const rawBody = req.rawBody;
        if (!rawBody) {
            res.status(401).json({ error: 'Missing raw body for signature verification' });
            return;
        }
        const httpUri = req.originalUrl;
        const isValid = (0, crypto_1.verifySignature)(httpUri, clientId, requestTime, rawBody, parsed.signature, config_1.config.antom.publicKey);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }
        next();
    }
    catch (err) {
        console.error('[SignatureVerify] Error:', err);
        res.status(401).json({ error: 'Signature verification failed' });
    }
}
//# sourceMappingURL=signatureVerify.js.map