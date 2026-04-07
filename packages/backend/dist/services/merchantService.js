"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantService = void 0;
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const prisma = new client_1.PrismaClient();
exports.merchantService = {
    async create(data) {
        return prisma.merchant.create({
            data: {
                shopName: data.shopName,
                region: data.region || 'CN',
                email: data.email,
                referenceMerchantId: `REF_${(0, uuid_1.v4)()}`,
            },
        });
    },
    async list() {
        return prisma.merchant.findMany({
            orderBy: { createdAt: 'desc' },
            include: { paymentMethods: true },
        });
    },
    async getById(id) {
        return prisma.merchant.findUnique({
            where: { id },
            include: {
                kycInfo: true,
                paymentMethods: { orderBy: { createdAt: 'asc' } },
                entityAssociations: { orderBy: { createdAt: 'asc' } },
            },
        });
    },
    async updateWfAccount(id, wfAccountId) {
        return prisma.merchant.update({
            where: { id },
            data: { wfAccountId },
        });
    },
    async upsertKyc(merchantId, data) {
        const fields = {
            legalName: data.legalName,
            companyType: data.companyType,
            certificateType: data.certificateType,
            certificateNo: data.certificateNo,
            branchName: data.branchName,
            companyUnit: data.companyUnit,
            addressRegion: data.addressRegion,
            addressState: data.addressState,
            addressCity: data.addressCity,
            address1: data.address1,
            address2: data.address2,
            zipCode: data.zipCode,
            mcc: data.mcc,
            doingBusinessAs: data.doingBusinessAs,
            websiteUrl: data.websiteUrl,
            englishName: data.englishName,
            serviceDescription: data.serviceDescription,
            appName: data.appName,
            merchantBrandName: data.merchantBrandName,
            contactType: data.contactType,
            contactInfo: data.contactInfo,
            legalRepName: data.legalRepName,
            legalRepIdType: data.legalRepIdType,
            legalRepIdNo: data.legalRepIdNo,
            legalRepDob: data.legalRepDob,
            wfKycData: data.wfKycData ? JSON.stringify(data.wfKycData) : undefined,
        };
        return prisma.kycInfo.upsert({
            where: { merchantId },
            create: {
                merchantId,
                ...fields,
                wfKycData: data.wfKycData ? JSON.stringify(data.wfKycData) : null,
            },
            update: fields,
        });
    },
    async upsertEntityAssociations(merchantId, associations) {
        // Delete existing and re-create (simpler for demo)
        await prisma.entityAssociation.deleteMany({ where: { merchantId } });
        for (const assoc of associations) {
            await prisma.entityAssociation.create({
                data: {
                    merchantId,
                    associationType: assoc.associationType,
                    shareholdingRatio: assoc.shareholdingRatio,
                    fullName: assoc.fullName,
                    firstName: assoc.firstName,
                    lastName: assoc.lastName,
                    dateOfBirth: assoc.dateOfBirth,
                    idType: assoc.idType,
                    idNo: assoc.idNo,
                },
            });
        }
    },
    async register(merchantId, paymentMethodTypes) {
        const registrationRequestId = `REG_${(0, uuid_1.v4)()}`;
        // Update merchant with registration request ID and reset kycStatus to PENDING
        await prisma.merchant.update({
            where: { id: merchantId },
            data: { registrationRequestId, kycStatus: 'PENDING' },
        });
        // Clear rejectedFields on KYC info (in case of re-submission after SUPPLEMENT_REQUIRED)
        await prisma.kycInfo.updateMany({
            where: { merchantId },
            data: { rejectedFields: null },
        });
        // Create or reset payment methods to PENDING for this registration cycle
        for (const pmType of paymentMethodTypes) {
            const existing = await prisma.paymentMethod.findFirst({
                where: { merchantId, paymentMethodType: pmType },
            });
            if (!existing) {
                await prisma.paymentMethod.create({
                    data: { merchantId, paymentMethodType: pmType, status: 'PENDING' },
                });
            }
            else if (existing.status !== 'PENDING') {
                await prisma.paymentMethod.update({
                    where: { id: existing.id },
                    data: { status: 'PENDING', activatedAt: null, deactivatedAt: null },
                });
            }
        }
        return { registrationRequestId };
    },
    async offboard(merchantId) {
        const offboardingRequestId = `OFF_${(0, uuid_1.v4)()}`;
        await prisma.merchant.update({
            where: { id: merchantId },
            data: { offboardingRequestId },
        });
        return { offboardingRequestId };
    },
    async deactivatePaymentMethod(paymentMethodId) {
        return prisma.paymentMethod.update({
            where: { id: paymentMethodId },
            data: { status: 'INACTIVE', deactivatedAt: new Date() },
        });
    },
    async getPaymentMethods(merchantId) {
        return prisma.paymentMethod.findMany({
            where: { merchantId },
            orderBy: { createdAt: 'asc' },
        });
    },
    async getNotifications(merchantId) {
        return prisma.notification.findMany({
            where: { merchantId },
            orderBy: { processedAt: 'desc' },
        });
    },
    async getStats(merchantId) {
        const where = merchantId ? { id: merchantId } : {};
        const [total, approved, pending, offboarded] = await Promise.all([
            prisma.merchant.count({ where }),
            prisma.merchant.count({ where: { ...where, kycStatus: 'APPROVED' } }),
            prisma.merchant.count({ where: { ...where, kycStatus: 'PENDING' } }),
            prisma.merchant.count({ where: { ...where, status: 'OFFBOARDED' } }),
        ]);
        return { total, approved, pending, offboarded };
    },
    async getRecentNotifications(limit = 10, merchantId) {
        return prisma.notification.findMany({
            where: merchantId ? { merchantId } : undefined,
            orderBy: { processedAt: 'desc' },
            take: limit,
            include: { merchant: { select: { shopName: true } } },
        });
    },
};
//# sourceMappingURL=merchantService.js.map