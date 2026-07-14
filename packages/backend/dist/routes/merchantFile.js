"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMerchantFileRouter = createMerchantFileRouter;
const express_1 = require("express");
const uuid_1 = require("uuid");
const merchantFileService_1 = require("../services/merchantFileService");
const merchantFileRepository_1 = require("../services/merchantFileRepository");
const multipart_1 = require("../utils/multipart");
const MAX_MULTIPART_REQUEST_SIZE = merchantFileService_1.MAX_FILE_SIZE + 256 * 1024;
class UploadRequestError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
function createMerchantFileRouter(dependencies) {
    const router = (0, express_1.Router)();
    router.get('/:id/files', async (req, res) => {
        const merchantId = paramStr(req.params.id);
        try {
            const merchant = await dependencies.findMerchant(merchantId);
            if (!merchant) {
                res.status(404).json({ error: 'Merchant not found' });
                return;
            }
            const files = await dependencies.listFiles(merchantId);
            res.json({ data: files });
        }
        catch (error) {
            console.error(`[MerchantFile] Failed to list files for merchant ${merchantId}:`, error);
            res.status(500).json({ error: 'Failed to list merchant files' });
        }
    });
    router.post('/:id/files', async (req, res) => {
        const merchantId = paramStr(req.params.id);
        let parsedFile;
        try {
            const rawBody = await readRequestBody(req, MAX_MULTIPART_REQUEST_SIZE);
            parsedFile = await (0, multipart_1.parseMultipartFile)(req.headers['content-type'] || '', rawBody);
            if (parsedFile.buffer.length > merchantFileService_1.MAX_FILE_SIZE) {
                throw new UploadRequestError(413, 'File size must not exceed 5 MB');
            }
            parsedFile.fileName = (0, merchantFileService_1.validateMerchantFile)(parsedFile.fileName, parsedFile.buffer.length);
        }
        catch (error) {
            const statusCode = error instanceof UploadRequestError ? error.statusCode : 400;
            const message = error instanceof Error ? error.message : 'Invalid file upload';
            res.status(statusCode).json({ error: message });
            return;
        }
        let merchant;
        try {
            merchant = await dependencies.findMerchant(merchantId);
        }
        catch (error) {
            console.error(`[MerchantFile] Failed to load merchant ${merchantId}:`, error);
            res.status(500).json({ error: 'Failed to load merchant' });
            return;
        }
        if (!merchant) {
            res.status(404).json({ error: 'Merchant not found' });
            return;
        }
        if (!merchant.referenceMerchantId) {
            res.status(409).json({ error: 'Merchant reference ID is missing' });
            return;
        }
        const requestId = `FILE_${(0, uuid_1.v4)()}`;
        let uploadResult;
        try {
            uploadResult = await dependencies.uploadFile({
                requestId,
                referenceMerchantId: merchant.referenceMerchantId,
                fileName: parsedFile.fileName,
                mimeType: parsedFile.mimeType,
                buffer: parsedFile.buffer,
            });
        }
        catch (error) {
            console.error(`[MerchantFile] Antom upload failed for merchant ${merchantId}, request ${requestId}:`, error);
            res.status(502).json({ error: 'Failed to upload file to Antom' });
            return;
        }
        if (uploadResult.result?.resultStatus !== 'S') {
            const statusCode = uploadResult.result?.resultStatus === 'F' ? 400 : 502;
            res.status(statusCode).json({
                error: uploadResult.result?.resultMessage || 'Antom upload did not complete',
                result: uploadResult.result,
            });
            return;
        }
        if (!uploadResult.fileKey || !uploadResult.fileName || !uploadResult.fileSize || !uploadResult.fileSha256) {
            res.status(502).json({ error: 'Antom upload response is missing file metadata' });
            return;
        }
        const fileSize = Number(uploadResult.fileSize);
        let returnedFileName;
        try {
            returnedFileName = (0, merchantFileService_1.validateMerchantFile)(uploadResult.fileName, fileSize);
        }
        catch {
            res.status(502).json({ error: 'Antom upload response contains invalid file metadata' });
            return;
        }
        if (fileSize !== parsedFile.buffer.length ||
            uploadResult.fileKey.length > 256 ||
            !/^[a-f0-9]{64}$/i.test(uploadResult.fileSha256)) {
            res.status(502).json({ error: 'Antom upload response contains invalid file metadata' });
            return;
        }
        try {
            const savedFile = await dependencies.saveFile({
                merchantId,
                requestId,
                originalFileName: parsedFile.fileName,
                fileName: returnedFileName,
                fileKey: uploadResult.fileKey,
                fileSize,
                fileSha256: uploadResult.fileSha256,
                mimeType: parsedFile.mimeType,
            });
            res.status(201).json(savedFile);
        }
        catch (error) {
            console.error(`[MerchantFile] Failed to persist upload ${requestId} for merchant ${merchantId}:`, error);
            res.status(500).json({ error: 'File uploaded but metadata could not be saved' });
        }
    });
    return router;
}
async function readRequestBody(req, maxBytes) {
    const declaredLength = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        req.resume();
        throw new UploadRequestError(413, 'File size must not exceed 5 MB');
    }
    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalBytes = 0;
        let exceeded = false;
        req.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
                exceeded = true;
                chunks.length = 0;
                return;
            }
            if (!exceeded)
                chunks.push(chunk);
        });
        req.on('end', () => {
            if (exceeded) {
                reject(new UploadRequestError(413, 'File size must not exceed 5 MB'));
                return;
            }
            resolve(Buffer.concat(chunks, totalBytes));
        });
        req.on('error', reject);
    });
}
function paramStr(value) {
    return Array.isArray(value) ? value[0] : value;
}
exports.default = createMerchantFileRouter({
    findMerchant: (id) => merchantFileRepository_1.merchantFileRepository.findMerchant(id),
    uploadFile: (input) => merchantFileService_1.merchantFileUploader.uploadFile(input),
    saveFile: (data) => merchantFileRepository_1.merchantFileRepository.saveFile(data),
    listFiles: (merchantId) => merchantFileRepository_1.merchantFileRepository.listFiles(merchantId),
});
//# sourceMappingURL=merchantFile.js.map