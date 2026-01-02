-- Create membership_renewal_requests table
CREATE TABLE IF NOT EXISTS `membership_renewal_requests` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `memberId` INT NOT NULL,
  `assignmentId` INT NOT NULL COMMENT 'ID from member_plan_assignment table',
  `planId` INT NOT NULL,
  `paymentMode` VARCHAR(191) DEFAULT NULL,
  `amountPaid` DOUBLE DEFAULT NULL,
  `requestedBy` INT NOT NULL COMMENT 'User ID who requested (admin/receptionist)',
  `requestedByRole` VARCHAR(50) DEFAULT NULL COMMENT 'Role: admin, receptionist',
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending' COMMENT 'pending, approved, rejected',
  `approvedBy` INT DEFAULT NULL COMMENT 'Admin ID who approved',
  `approvedAt` DATETIME(3) DEFAULT NULL,
  `rejectedAt` DATETIME(3) DEFAULT NULL,
  `rejectionReason` TEXT DEFAULT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `memberId` (`memberId`),
  KEY `assignmentId` (`assignmentId`),
  KEY `planId` (`planId`),
  KEY `requestedBy` (`requestedBy`),
  KEY `status` (`status`),
  CONSTRAINT `membership_renewal_requests_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `member` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `membership_renewal_requests_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `member_plan_assignment` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `membership_renewal_requests_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `memberplan` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

