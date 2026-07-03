CREATE TABLE "audit_logs" (
	"audit_log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_type" varchar(50) NOT NULL,
	"se_admin_user_id" uuid,
	"action_type" varchar(100) NOT NULL,
	"target_type" varchar(100),
	"target_id" uuid,
	"result" varchar(50) NOT NULL,
	"detail" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_notification_logs" (
	"email_notification_log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_account_id" uuid NOT NULL,
	"to_email" varchar(255) NOT NULL,
	"notification_type" varchar(100) NOT NULL,
	"send_status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"retry_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "se_admin_users" (
	"se_admin_user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255),
	"is_locked" boolean DEFAULT false NOT NULL,
	"failed_login_count" smallint DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "se_admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_id" varchar(255) PRIMARY KEY NOT NULL,
	"se_admin_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_accounts" (
	"shop_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_name" varchar(255) NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"initial_password_hash" varchar(255),
	"account_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"issued_by_se_admin_user_id" uuid NOT NULL,
	"notification_sent_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "email_notification_logs" ADD CONSTRAINT "email_notification_logs_shop_account_id_shop_accounts_shop_account_id_fk" FOREIGN KEY ("shop_account_id") REFERENCES "public"."shop_accounts"("shop_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_se_admin_user_id_se_admin_users_se_admin_user_id_fk" FOREIGN KEY ("se_admin_user_id") REFERENCES "public"."se_admin_users"("se_admin_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_accounts" ADD CONSTRAINT "shop_accounts_issued_by_se_admin_user_id_se_admin_users_se_admin_user_id_fk" FOREIGN KEY ("issued_by_se_admin_user_id") REFERENCES "public"."se_admin_users"("se_admin_user_id") ON DELETE no action ON UPDATE no action;