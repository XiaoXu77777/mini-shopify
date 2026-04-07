import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export const merchantService = {
  async create(data: { shopName: string; region?: string; email: string }) {
    return prisma.merchant.create({
      data: {
        shopName: data.shopName,
        region: data.region || 'CN',
        email: data.email,
        referenceMerchantId: `REF_${uuidv4()}`,
      },
    });
  },

  async list() {
    return prisma.merchant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { paymentMethods: true },
    });
  },

  async getById(id: string) {
    return prisma.merchant.findUnique({
      where: { id },
      include: {
        kycInfo: true,
        paymentMethods: { orderBy: { createdAt: 'asc' } },
        entityAssociations: { orderBy: { createdAt: 'asc' } },
      },
    });
  },

  async updateWfAccount(id: string, wfAccountId: string) {
    return prisma.merchant.update({
      where: { id },
      data: { wfAccountId },
    });
  },

  async upsertKyc(
    merchantId: string,
    data: {
      // Company info
      legalName?: string;
      companyType?: string;
      certificateType?: string;
      certificateNo?: string;
      branchName?: string;
      companyUnit?: string;
      // Registered address
      addressRegion?: string;
      addressState?: string;
      addressCity?: string;
      address1?: string;
      address2?: string;
      zipCode?: string;
      // Business info
      mcc?: string;
      doingBusinessAs?: string;
      websiteUrl?: string;
      englishName?: string;
      serviceDescription?: string;
      appName?: string;
      merchantBrandName?: string;
      // Contact
      contactType?: string;
      contactInfo?: string;
      // Legal representative
      legalRepName?: string;
      legalRepIdType?: string;
      legalRepIdNo?: string;
      legalRepDob?: string;
      // WF data
      wfKycData?: Record<string, unknown>;
    }
  ) {
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

  async upsertEntityAssociations(
    merchantId: string,
    associations: {
      associationType: string;
      shareholdingRatio?: string;
      fullName?: string;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      idType?: string;
      idNo?: string;
    }[]
  ) {
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

  async register(merchantId: string, paymentMethodTypes: string[]) {
    const registrationRequestId = `REG_${uuidv4()}`;

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
      } else if (existing.status !== 'PENDING') {
        await prisma.paymentMethod.update({
          where: { id: existing.id },
          data: { status: 'PENDING', activatedAt: null, deactivatedAt: null },
        });
      }
    }

    return { registrationRequestId };
  },

  async offboard(merchantId: string) {
    const offboardingRequestId = `OFF_${uuidv4()}`;

    await prisma.merchant.update({
      where: { id: merchantId },
      data: { offboardingRequestId },
    });

    return { offboardingRequestId };
  },

  async deactivatePaymentMethod(paymentMethodId: string) {
    return prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { status: 'INACTIVE', deactivatedAt: new Date() },
    });
  },

  async getPaymentMethods(merchantId: string) {
    return prisma.paymentMethod.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getNotifications(merchantId: string) {
    return prisma.notification.findMany({
      where: { merchantId },
      orderBy: { processedAt: 'desc' },
    });
  },

  async getStats(merchantId?: string) {
    const where = merchantId ? { id: merchantId } : {};
    const [total, approved, pending, offboarded] = await Promise.all([
      prisma.merchant.count({ where }),
      prisma.merchant.count({ where: { ...where, kycStatus: 'APPROVED' } }),
      prisma.merchant.count({ where: { ...where, kycStatus: 'PENDING' } }),
      prisma.merchant.count({ where: { ...where, status: 'OFFBOARDED' } }),
    ]);
    return { total, approved, pending, offboarded };
  },

  async getRecentNotifications(limit = 10, merchantId?: string) {
    return prisma.notification.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { processedAt: 'desc' },
      take: limit,
      include: { merchant: { select: { shopName: true } } },
    });
  },
};
