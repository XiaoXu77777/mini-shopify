import { Router } from 'express';
import { MerchantFileUploadInput, AntomUploadFileResponse } from '../services/merchantFileService';
import { SaveMerchantFileInput } from '../services/merchantFileRepository';
interface MerchantFileRouteDependencies {
    findMerchant(id: string): Promise<{
        id: string;
        referenceMerchantId: string | null;
    } | null>;
    uploadFile(input: MerchantFileUploadInput): Promise<AntomUploadFileResponse>;
    saveFile(data: SaveMerchantFileInput): Promise<unknown>;
    listFiles(merchantId: string): Promise<unknown[]>;
}
export declare function createMerchantFileRouter(dependencies: MerchantFileRouteDependencies): Router;
declare const _default: Router;
export default _default;
//# sourceMappingURL=merchantFile.d.ts.map