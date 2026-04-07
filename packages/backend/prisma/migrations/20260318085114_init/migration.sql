-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopName" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'CN',
    "email" TEXT NOT NULL,
    "wfAccountId" TEXT,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "riskLevel" TEXT,
    "riskReasonCodes" TEXT,
    "registrationRequestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KycInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "businessType" TEXT,
    "legalName" TEXT,
    "idNumber" TEXT,
    "businessLicense" TEXT,
    "additionalInfo" TEXT,
    "wfKycData" TEXT,
    "rejectedFields" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KycInfo_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "paymentMethodType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "activatedAt" DATETIME,
    "deactivatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentMethod_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "notifyId" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KycInfo_merchantId_key" ON "KycInfo"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_notifyId_key" ON "Notification"("notifyId");
