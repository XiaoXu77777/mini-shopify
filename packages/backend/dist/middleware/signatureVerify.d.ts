import { Request, Response, NextFunction } from 'express';
/**
 * Middleware to verify Antom notification signatures.
 * In mock mode, signature verification is skipped.
 */
export declare function signatureVerify(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=signatureVerify.d.ts.map