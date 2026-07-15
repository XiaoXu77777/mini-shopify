import { signRequest } from '../utils/crypto';
export declare const MAX_FILE_SIZE: number;
export declare const UPLOAD_FILE_PATH = "/api/open/openapiv2_file/merchant/uploadFile";
export declare const ALLOWED_FILE_EXTENSIONS: Set<string>;
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
export declare function validateMerchantFile(fileName: string, fileSize: number): string;
export declare function calculateFileSha256(buffer: Buffer): string;
export declare function createMerchantFileUploader(overrides: Partial<FileUploaderDependencies> & Pick<FileUploaderDependencies, 'config'>): {
    uploadFile(input: MerchantFileUploadInput): Promise<AntomUploadFileResponse>;
};
export declare const merchantFileUploader: {
    uploadFile(input: MerchantFileUploadInput): Promise<AntomUploadFileResponse>;
};
export {};
//# sourceMappingURL=merchantFileService.d.ts.map