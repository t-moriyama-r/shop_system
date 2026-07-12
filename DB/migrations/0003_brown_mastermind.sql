CREATE TABLE "se_admin_email_notification_logs" (
	"se_admin_email_notification_log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"se_admin_user_id" uuid NOT NULL,
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
ALTER TABLE "se_admin_users" ADD COLUMN "must_change_password" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_accounts" ADD COLUMN "must_change_password" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "se_admin_email_notification_logs" ADD CONSTRAINT "se_admin_email_notification_logs_se_admin_user_id_se_admin_users_se_admin_user_id_fk" FOREIGN KEY ("se_admin_user_id") REFERENCES "public"."se_admin_users"("se_admin_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- 既にパスワードを設定済みの SE 管理者は初期パスワード変更の対象外とする
-- （DEFAULT true のままだと設定済みユーザーにも再変更が強制されてしまうため）
UPDATE "se_admin_users" SET "must_change_password" = false WHERE "password" IS NOT NULL;