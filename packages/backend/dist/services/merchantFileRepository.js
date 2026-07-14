"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantFileRepository = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.merchantFileRepository = {
    findMerchant(id) {
        return prisma.merchant.findUnique({
            where: { id },
            select: { id: true, referenceMerchantId: true },
        });
    },
    saveFile(data) {
        return prisma.merchantFile.create({ data });
    },
    listFiles(merchantId) {
        return prisma.merchantFile.findMany({
            where: { merchantId },
            orderBy: { createdAt: 'desc' },
        });
    },
};
//# sourceMappingURL=merchantFileRepository.js.map