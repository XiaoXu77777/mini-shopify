import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  MAX_FILE_SIZE,
  MerchantFileUploadInput,
  AntomUploadFileResponse,
  merchantFileUploader,
  validateMerchantFile,
} from '../services/merchantFileService';
import {
  SaveMerchantFileInput,
  merchantFileRepository,
} from '../services/merchantFileRepository';
import { parseMultipartFile } from '../utils/multipart';

const MAX_MULTIPART_REQUEST_SIZE = MAX_FILE_SIZE + 256 * 1024;

interface MerchantFileRouteDependencies {
  findMerchant(id: string): Promise<{ id: string; referenceMerchantId: string | null } | null>;
  uploadFile(input: MerchantFileUploadInput): Promise<AntomUploadFileResponse>;
  saveFile(data: SaveMerchantFileInput): Promise<unknown>;
  listFiles(merchantId: string): Promise<unknown[]>;
}

class UploadRequestError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function createMerchantFileRouter(
  dependencies: MerchantFileRouteDependencies,
): Router {
  const router = Router();

  router.get('/:id/files', async (req: Request, res: Response) => {
    const merchantId = paramStr(req.params.id);
    try {
      const merchant = await dependencies.findMerchant(merchantId);
      if (!merchant) {
        res.status(404).json({ error: 'Merchant not found' });
        return;
      }
      const files = await dependencies.listFiles(merchantId);
      res.json({ data: files });
    } catch (error) {
      console.error(`[MerchantFile] Failed to list files for merchant ${merchantId}:`, error);
      res.status(500).json({ error: 'Failed to list merchant files' });
    }
  });

  router.post('/:id/files', async (req: Request, res: Response) => {
    const merchantId = paramStr(req.params.id);
    let parsedFile;
    try {
      const rawBody = await readRequestBody(req, MAX_MULTIPART_REQUEST_SIZE);
      parsedFile = await parseMultipartFile(req.headers['content-type'] || '', rawBody);
      if (parsedFile.buffer.length > MAX_FILE_SIZE) {
        throw new UploadRequestError(413, 'File size must not exceed 5 MB');
      }
      parsedFile.fileName = validateMerchantFile(parsedFile.fileName, parsedFile.buffer.length);
    } catch (error) {
      const statusCode = error instanceof UploadRequestError ? error.statusCode : 400;
      const message = error instanceof Error ? error.message : 'Invalid file upload';
      res.status(statusCode).json({ error: message });
      return;
    }

    let merchant;
    try {
      merchant = await dependencies.findMerchant(merchantId);
    } catch (error) {
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

    const requestId = `FILE_${uuidv4()}`;
    let uploadResult: AntomUploadFileResponse;
    try {
      uploadResult = await dependencies.uploadFile({
        requestId,
        referenceMerchantId: merchant.referenceMerchantId,
        fileName: parsedFile.fileName,
        mimeType: parsedFile.mimeType,
        buffer: parsedFile.buffer,
      });
    } catch (error) {
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
    let returnedFileName: string;
    try {
      returnedFileName = validateMerchantFile(uploadResult.fileName, fileSize);
    } catch {
      res.status(502).json({ error: 'Antom upload response contains invalid file metadata' });
      return;
    }
    if (
      fileSize !== parsedFile.buffer.length ||
      uploadResult.fileKey.length > 256 ||
      !/^[a-f0-9]{64}$/i.test(uploadResult.fileSha256)
    ) {
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
    } catch (error) {
      console.error(`[MerchantFile] Failed to persist upload ${requestId} for merchant ${merchantId}:`, error);
      res.status(500).json({ error: 'File uploaded but metadata could not be saved' });
    }
  });

  return router;
}

async function readRequestBody(req: Request, maxBytes: number): Promise<Buffer> {
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    req.resume();
    throw new UploadRequestError(413, 'File size must not exceed 5 MB');
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let exceeded = false;

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        exceeded = true;
        chunks.length = 0;
        return;
      }
      if (!exceeded) chunks.push(chunk);
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

function paramStr(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export default createMerchantFileRouter({
  findMerchant: (id) => merchantFileRepository.findMerchant(id),
  uploadFile: (input) => merchantFileUploader.uploadFile(input),
  saveFile: (data) => merchantFileRepository.saveFile(data),
  listFiles: (merchantId) => merchantFileRepository.listFiles(merchantId),
});
