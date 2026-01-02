-- Multiple Plans Migration
-- Run this SQL script directly in your MySQL database

-- Step 1: Create member_plan_assignment table
CREATE TABLE IF NOT EXISTS `member_plan_assignment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `memberId` INT NOT NULL,
  `planId` INT NOT NULL,
  `membershipFrom` DATETIME(3) NOT NULL,
  `membershipTo` DATETIME(3) NOT NULL,
  `paymentMode` VARCHAR(191) NULL,
  `amountPaid` DOUBLE NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
  `assignedBy` INT NULL COMMENT 'Admin/Receptionist who assigned this plan',
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `member_plan_assignment_memberId_idx` (`memberId`),
  INDEX `member_plan_assignment_planId_idx` (`planId`),
  INDEX `member_plan_assignment_status_idx` (`status`),
  CONSTRAINT `member_plan_assignment_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `member` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `member_plan_assignment_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `memberplan` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Migrate existing single plan data to member_plan_assignment table
INSERT INTO `member_plan_assignment` 
  (`memberId`, `planId`, `membershipFrom`, `membershipTo`, `paymentMode`, `amountPaid`, `status`, `assignedBy`, `assignedAt`, `createdAt`, `updatedAt`)
SELECT 
  m.id as memberId,
  m.planId,
  COALESCE(m.membershipFrom, m.joinDate) as membershipFrom,
  COALESCE(m.membershipTo, DATE_ADD(m.joinDate, INTERVAL 30 DAY)) as membershipTo,
  m.paymentMode,
  m.amountPaid,
  m.status,
  m.adminId as assignedBy,
  m.joinDate as assignedAt,
  m.joinDate as createdAt,
  CURRENT_TIMESTAMP(3) as updatedAt
FROM `member` m
WHERE m.planId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `member_plan_assignment` mpa 
    WHERE mpa.memberId = m.id AND mpa.planId = m.planId
  );

-- Step 3: Verify migration
SELECT 
  'Migration Complete!' as Status,
  COUNT(*) as TotalAssignments,
  COUNT(DISTINCT memberId) as UniqueMembersWithPlans
FROM member_plan_assignment;

-- Show sample data
SELECT * FROM member_plan_assignment LIMIT 5;

