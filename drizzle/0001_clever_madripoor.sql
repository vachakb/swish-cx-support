CREATE TABLE `faq_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`categoryId` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`tags` text,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`categoryId`) REFERENCES `faq_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `faq_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL
);
