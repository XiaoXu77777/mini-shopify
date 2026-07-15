"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantFileUploader = exports.ALLOWED_FILE_EXTENSIONS = exports.UPLOAD_FILE_PATH = exports.MAX_FILE_SIZE = void 0;
exports.validateMerchantFile = validateMerchantFile;
exports.calculateFileSha256 = calculateFileSha256;
exports.createMerchantFileUploader = createMerchantFileUploader;
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
const config_1 = require("../utils/config");
const crypto_2 = require("../utils/crypto");
exports.MAX_FILE_SIZE = 5 * 1024 * 1024;
exports.UPLOAD_FILE_PATH = '/api/open/openapiv2_file/merchant/uploadFile';
exports.ALLOWED_FILE_EXTENSIONS = new Set([
    'png', 'jpg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv',
]);
function validateMerchantFile(fileName, fileSize) {
    if (!fileName || fileName.includes('\0') || /[\u0000-\u001f\u007f]/.test(fileName)) {
        throw new Error('Invalid file name');
    }
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
        throw new Error('File must not be empty');
    }
    if (fileSize > exports.MAX_FILE_SIZE) {
        throw new Error('File size must not exceed 5 MB');
    }
    const safeFileName = path_1.default.basename(fileName);
    if (safeFileName.length > 128) {
        throw new Error('File name must not exceed 128 characters');
    }
    const extension = path_1.default.extname(safeFileName).slice(1).toLowerCase();
    if (!exports.ALLOWED_FILE_EXTENSIONS.has(extension)) {
        throw new Error(`Unsupported file type: .${extension || '(none)'}`);
    }
    return safeFileName;
}
function calculateFileSha256(buffer) {
    return (0, crypto_1.createHash)('sha256').update(buffer).digest('hex');
}
function createMerchantFileUploader(overrides) {
    const dependencies = {
        fetch: globalThis.fetch,
        sign: crypto_2.signRequest,
        now: () => new Date(),
        sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
        ...overrides,
    };
    return {
        async uploadFile(input) {
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
                const signature = dependencies.sign(exports.UPLOAD_FILE_PATH, dependencies.config.clientId, requestTime, bodyJson, dependencies.config.privateKey);
                const form = new FormData();
                form.append('body', bodyJson);
                form.append('file', new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), safeFileName);
                const headers = {
                    'client-id': dependencies.config.clientId,
                    'Request-Time': requestTime,
                    Signature: (0, crypto_2.buildSignatureHeader)(signature),
                };
                if (dependencies.config.agentToken) {
                    headers['agent-token'] = dependencies.config.agentToken;
                }
                const response = await dependencies.fetch(`${dependencies.config.bigSizeBaseUrl.replace(/\/+$/, '')}${exports.UPLOAD_FILE_PATH}`, { method: 'POST', headers, body: form });
                const responseBody = await response.text();
                let result;
                try {
                    result = JSON.parse(responseBody);
                }
                catch {
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
function validateIdentifier(fieldName, value) {
    if (!value || value.length > 64) {
        throw new Error(`${fieldName} must contain 1 to 64 characters`);
    }
}
function validateSuccessfulResponse(response) {
    if (!response.fileKey || !response.fileName || !response.fileSize) {
        throw new Error('Antom uploadFile success response is missing file metadata');
    }
}
exports.merchantFileUploader = {
    uploadFile(input) {
        return createMerchantFileUploader({
            config: {
                mockMode: config_1.config.mockMode,
                bigSizeBaseUrl: config_1.config.antom.bigSizeBaseUrl,
                clientId: config_1.config.antom.clientId,
                privateKey: config_1.config.antom.privateKey,
                integrationPartnerId: config_1.config.antom.parentMerchantId,
                agentToken: config_1.config.antom.agentToken,
                sandbox: config_1.config.antom.sandbox,
            },
        }).uploadFile(input);
    },
};
//# sourceMappingURL=merchantFileService.js.map