CREATE TABLE `MerchantFile` (
    `id` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(64) NOT NULL,
    `originalFileName` VARCHAR(128) NOT NULL,
    `fileName` VARCHAR(128) NOT NULL,
    `fileKey` VARCHAR(256) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `fileSha256` CHAR(64) NOT NULL,
    `mimeType` VARCHAR(128) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MerchantFile_requestId_key`(`requestId`),
    UNIQUE INDEX `MerchantFile_fileKey_key`(`fileKey`),
    INDEX `MerchantFile_merchantId_idx`(`merchantId`),
    INDEX `MerchantFile_fileSha256_idx`(`fileSha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MerchantFile`
    ADD CONSTRAINT `MerchantFile_merchantId_fkey`
    FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
