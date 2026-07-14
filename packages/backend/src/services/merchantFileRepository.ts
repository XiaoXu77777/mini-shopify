import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

export const merchantFileRepository = {
  findMerchant(id: string) {
    return prisma.merchant.findUnique({
      where: { id },
      select: { id: true, referenceMerchantId: true },
    });
  },

  saveFile(data: SaveMerchantFileInput) {
    return prisma.merchantFile.create({ data });
  },

  listFiles(merchantId: string) {
    return prisma.merchantFile.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
