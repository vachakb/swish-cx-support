CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text NOT NULL,
	`messageId` text,
	`url` text NOT NULL,
	`sha256` text NOT NULL,
	`integrityVerdict` text,
	`visionScore` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`customerId` text,
	`orderId` text,
	`channel` text NOT NULL,
	`status` text DEFAULT 'bot' NOT NULL,
	`subject` text,
	`sentiment` text,
	`assignedTo` text,
	`escalationReason` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`city` text NOT NULL,
	`area` text NOT NULL,
	`accountAgeDays` integer DEFAULT 0 NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`isValid` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`payload` text,
	`traceId` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`orderId` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unitPrice` integer NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_tracking` (
	`orderId` text PRIMARY KEY NOT NULL,
	`etaSeconds` integer NOT NULL,
	`etaLastComputedAt` integer NOT NULL,
	`riderLat` real,
	`riderLng` real,
	`riderLastGpsAt` integer,
	`distanceRemainingM` integer,
	`stage` text NOT NULL,
	`stateLastTransitionAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customerId` text NOT NULL,
	`status` text NOT NULL,
	`placedAt` integer NOT NULL,
	`promisedBy` integer NOT NULL,
	`deliveredAt` integer,
	`podId` text NOT NULL,
	`riderId` text,
	`addressArea` text NOT NULL,
	`subtotal` integer NOT NULL,
	`deliveryFee` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`paymentMethod` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `resolutions` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text NOT NULL,
	`customerId` text NOT NULL,
	`orderId` text,
	`type` text NOT NULL,
	`amount` integer,
	`reason` text NOT NULL,
	`decidedBy` text NOT NULL,
	`status` text NOT NULL,
	`idempotencyKey` text NOT NULL,
	`policyTrace` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resolutions_idempotencyKey_unique` ON `resolutions` (`idempotencyKey`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`customerId` text NOT NULL,
	`orderId` text,
	`channel` text DEFAULT 'web' NOT NULL,
	`suggestedMessage` text NOT NULL,
	`tags` text,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `serviceability` (
	`id` text PRIMARY KEY NOT NULL,
	`city` text NOT NULL,
	`area` text NOT NULL,
	`serviceable` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `traces` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text NOT NULL,
	`messageId` text,
	`intent` text,
	`confidence` real,
	`sentiment` text,
	`latencyMs` integer,
	`steps` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`customerId` text PRIMARY KEY NOT NULL,
	`creditBalance` integer DEFAULT 0 NOT NULL,
	`referralCode` text NOT NULL,
	`referralsCompleted` integer DEFAULT 0 NOT NULL,
	`referralRewardEarned` integer DEFAULT 0 NOT NULL,
	`referralRewardPending` integer DEFAULT 0 NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
