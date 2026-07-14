export interface SaveMerchantFileInput {
    merchantId: string;
    requestId: string;
    originalFileName: string;
    fileName: string;
    fileKey: string;
    fileSize: number;
    fileSha256: string;
    mimeType: string;
}
export declare const merchantFileRepository: {
    findMerchant(id: string): import(".prisma/client").Prisma.Prisma__MerchantClient<{
        referenceMerchantId: string | null;
        id: string;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    saveFile(data: SaveMerchantFileInput): import(".prisma/client").Prisma.Prisma__MerchantFileClient<{
        merchantId: string;
        id: string;
        createdAt: Date;
        fileName: string;
        requestId: string;
        originalFileName: string;
        fileKey: string;
        fileSize: number;
        fileSha256: string;
        mimeType: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    listFiles(merchantId: string): import(".prisma/client").Prisma.PrismaPromise<{
        merchantId: string;
        id: string;
        createdAt: Date;
        fileName: string;
        requestId: string;
        originalFileName: string;
        fileKey: string;
        fileSize: number;
        fileSha256: string;
        mimeType: string | null;
    }[]>;
};
//# sourceMappingURL=merchantFileRepository.d.ts.map