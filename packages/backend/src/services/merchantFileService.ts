import { createHash } from 'crypto';
import path from 'path';
import { config as appConfig } from '../utils/config';
import { buildSignatureHeader, signRequest } from '../utils/crypto';

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const UPLOAD_FILE_PATH = '/api/open/openapiv2_file/merchant/uploadFile';
export const ALLOWED_FILE_EXTENSIONS = new Set([
  'png', 'jpg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv',
]);

export interface MerchantFileUploadInput {
  requestId: string;
  referenceMerchantId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface AntomUploadFileResponse {
  result: {
    resultCode: string;
    resultMessage: string;
    resultStatus: 'S' | 'F' | 'U';
  };
  fileName?: string;
  fileKey?: string;
  fileSize?: string;
  fileSha256?: string;
}

interface FileUploaderConfig {
  mockMode: boolean;
  bigSizeBaseUrl: string;
  clientId: string;
  privateKey: string;
  integrationPartnerId?: string;
  agentToken?: string;
  sandbox?: boolean;
}

interface FileUploaderDependencies {
  config: FileUploaderConfig;
  fetch: typeof fetch;
  sign: typeof signRequest;
  now: () => Date;
  sleep: (delayMs: number) => Promise<void>;
}

export function validateMerchantFile(fileName: string, fileSize: number): string {
  if (!fileName || fileName.includes('\0') || /[\u0000-\u001f\u007f]/.test(fileName)) {
    throw new Error('Invalid file name');
  }
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    throw new Error('File must not be empty');
  }
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error('File size must not exceed 5 MB');
  }

  const safeFileName = path.basename(fileName);
  if (safeFileName.length > 128) {
    throw new Error('File name must not exceed 128 characters');
  }
  const extension = path.extname(safeFileName).slice(1).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported file type: .${extension || '(none)'}`);
  }
  return safeFileName;
}

export function calculateFileSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function createMerchantFileUploader(
  overrides: Partial<FileUploaderDependencies> & Pick<FileUploaderDependencies, 'config'>,
) {
  const dependencies: FileUploaderDependencies = {
    fetch: globalThis.fetch,
    sign: signRequest,
    now: () => new Date(),
    sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    ...overrides,
  };

  return {
    async uploadFile(input: MerchantFileUploadInput): Promise<AntomUploadFileResponse> {
      const safeFileName = validateMerchantFile(input.fileName, input.buffer.length);
      validateIdentifier('requestId', input.requestId);
      validateIdentifier('referenceMerchantId', input.referenceMerchantId);

      const fileSha256 = calculateFileSha256(input.buffer);
      if (dependencies.config.mockMode) {
        return {
          result: {
            resultCode: 'SUCCESS',
            resultMessage: 'success',
            resultStatus: 'S',
          },
          fileName: safeFileName,
          fileKey: `mock_${input.requestId}_${fileSha256.slice(0, 16)}`,
          fileSize: String(input.buffer.length),
          fileSha256,
        };
      }

      if (dependencies.config.sandbox) {
        throw new Error('uploadFile is unavailable in sandbox; enable MOCK_MODE or use production credentials');
      }

      const integrationPartnerId = dependencies.config.integrationPartnerId || '';
      validateIdentifier('integrationPartnerId', integrationPartnerId);
      if (!dependencies.config.clientId || !dependencies.config.privateKey) {
        throw new Error('Antom upload credentials are not configured');
      }

      const bodyJson = JSON.stringify({
        requestId: input.requestId,
        merchant: {
          integrationPartnerId,
          referenceMerchantId: input.referenceMerchantId,
        },
        fileSha256,
      });

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const requestTime = dependencies.now().toISOString().replace('Z', '+00:00');
        const signature = dependencies.sign(
          UPLOAD_FILE_PATH,
          dependencies.config.clientId,
          requestTime,
          bodyJson,
          dependencies.config.privateKey,
        );
        const form = new FormData();
        form.append('body', bodyJson);
        form.append(
          'file',
          new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
          safeFileName,
        );

        const headers: Record<string, string> = {
          'client-id': dependencies.config.clientId,
          'Request-Time': requestTime,
          Signature: buildSignatureHeader(signature),
        };
        if (dependencies.config.agentToken) {
          headers['agent-token'] = dependencies.config.agentToken;
        }

        const response = await dependencies.fetch(
          `${dependencies.config.bigSizeBaseUrl.replace(/\/+$/, '')}${UPLOAD_FILE_PATH}`,
          { method: 'POST', headers, body: form },
        );
        const responseBody = await response.text();
        let result: AntomUploadFileResponse;
        try {
          result = JSON.parse(responseBody) as AntomUploadFileResponse;
        } catch {
          throw new Error(`Antom uploadFile returned invalid JSON (HTTP ${response.status})`);
        }

        if (result.result?.resultStatus === 'U' && attempt < maxAttempts) {
          await dependencies.sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        if (result.result?.resultStatus === 'S') {
          validateSuccessfulResponse(result);
        }
        return { ...result, fileSha256 };
      }

      throw new Error('Antom uploadFile retry exhausted');
    },
  };
}

function validateIdentifier(fieldName: string, value: string): void {
  if (!value || value.length > 64) {
    throw new Error(`${fieldName} must contain 1 to 64 characters`);
  }
}

function validateSuccessfulResponse(response: AntomUploadFileResponse): void {
  if (!response.fileKey || !response.fileName || !response.fileSize) {
    throw new Error('Antom uploadFile success response is missing file metadata');
  }
}

export const merchantFileUploader = {
  uploadFile(input: MerchantFileUploadInput) {
    return createMerchantFileUploader({
      config: {
        mockMode: appConfig.mockMode,
        bigSizeBaseUrl: appConfig.antom.bigSizeBaseUrl,
        clientId: appConfig.antom.clientId,
        privateKey: appConfig.antom.privateKey,
        integrationPartnerId: appConfig.antom.parentMerchantId,
        agentToken: appConfig.antom.agentToken,
        sandbox: appConfig.antom.sandbox,
      },
    }).uploadFile(input);
  },
};
