# ER図

> バージョン: 3 | 更新日時: 2026/7/12 0:00:00

SE管理画面システムのER図。SE管理者の認証・セッション管理、ショップアカウント発行、操作監査ログ、メール送信ログ（ショップ宛・SE管理者宛）の6テーブルで構成される。audit_logsのse_admin_user_idはCLI操作時にNULLとなるため厳密な外部キー制約は※要確認。（テーブル定義.mdとの整合を取るため、テーブル名・カラム構成を修正）

### エンティティ一覧

**SE_ADMIN_USERS**

| カラム名 | データ型 | キー |
| --- | --- | --- |
| se_admin_user_id | UUID | PK |
| email | VARCHAR(255) |  |
| password | VARCHAR(255) |  |
| must_change_password | BOOLEAN |  |
| is_locked | BOOLEAN |  |
| failed_login_count | SMALLINT |  |
| last_login_at | TIMESTAMP WITH TIME ZONE |  |
| is_deleted | BOOLEAN |  |
| deleted_at | TIMESTAMP WITH TIME ZONE |  |
| created_at | TIMESTAMP WITH TIME ZONE |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  |

**SESSIONS**

| カラム名 | データ型 | キー |
| --- | --- | --- |
| session_id | VARCHAR(255) | PK |
| se_admin_user_id | UUID | FK |
| expires_at | TIMESTAMP WITH TIME ZONE |  |
| created_at | TIMESTAMP WITH TIME ZONE |  |

**SHOP_ACCOUNTS**

| カラム名 | データ型 | キー |
| --- | --- | --- |
| shop_account_id | UUID | PK |
| shop_name | VARCHAR(255) |  |
| contact_name | VARCHAR(255) |  |
| email | VARCHAR(255) |  |
| initial_password_hash | VARCHAR(255) |  |
| must_change_password | BOOLEAN |  |
| account_status | VARCHAR(50) |  |
| issued_by_se_admin_user_id | UUID | FK |
| notification_sent_at | TIMESTAMP WITH TIME ZONE |  |
| is_deleted | BOOLEAN |  |
| deleted_at | TIMESTAMP WITH TIME ZONE |  |
| created_at | TIMESTAMP WITH TIME ZONE |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  |

**AUDIT_LOGS**

| カラム名 | データ型 | キー |
| --- | --- | --- |
| audit_log_id | UUID | PK |
| operator_type | VARCHAR(50) |  |
| se_admin_user_id | UUID | FK |
| action_type | VARCHAR(100) |  |
| target_type | VARCHAR(100) |  |
| target_id | UUID |  |
| result | VARCHAR(50) |  |
| detail | TEXT |  |
| ip_address | VARCHAR(45) |  |
| user_agent | TEXT |  |
| created_at | TIMESTAMP WITH TIME ZONE |  |

**EMAIL_NOTIFICATION_LOGS**

| カラム名 | データ型 | キー |
| --- | --- | --- |
| email_notification_log_id | UUID | PK |
| shop_account_id | UUID | FK |
| to_email | VARCHAR(255) |  |
| notification_type | VARCHAR(100) |  |
| send_status | VARCHAR(50) |  |
| sent_at | TIMESTAMP WITH TIME ZONE |  |
| error_message | TEXT |  |
| retry_count | SMALLINT |  |
| created_at | TIMESTAMP WITH TIME ZONE |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  |

**SE_ADMIN_EMAIL_NOTIFICATION_LOGS**

| カラム名 | データ型 | キー |
| --- | --- | --- |
| se_admin_email_notification_log_id | UUID | PK |
| se_admin_user_id | UUID | FK |
| to_email | VARCHAR(255) |  |
| notification_type | VARCHAR(100) |  |
| send_status | VARCHAR(50) |  |
| sent_at | TIMESTAMP WITH TIME ZONE |  |
| error_message | TEXT |  |
| retry_count | SMALLINT |  |
| created_at | TIMESTAMP WITH TIME ZONE |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  |

### リレーション

- SE_ADMIN_USERS → SESSIONS (1:N)
- SE_ADMIN_USERS → SHOP_ACCOUNTS (1:N)
- SE_ADMIN_USERS → AUDIT_LOGS (1:N)
- SE_ADMIN_USERS → SE_ADMIN_EMAIL_NOTIFICATION_LOGS (1:N)
- SHOP_ACCOUNTS → EMAIL_NOTIFICATION_LOGS (1:N)

### ER図

```mermaid
erDiagram
    se_admin_users {
        UUID se_admin_user_id PK
        VARCHAR_255 email
        VARCHAR_255 password
        BOOLEAN must_change_password
        BOOLEAN is_locked
        SMALLINT failed_login_count
        TIMESTAMP_WITH_TIME_ZONE last_login_at
        BOOLEAN is_deleted
        TIMESTAMP_WITH_TIME_ZONE deleted_at
        TIMESTAMP_WITH_TIME_ZONE created_at
        TIMESTAMP_WITH_TIME_ZONE updated_at
    }
    sessions {
        VARCHAR_255 session_id PK
        UUID se_admin_user_id FK
        TIMESTAMP_WITH_TIME_ZONE expires_at
        TIMESTAMP_WITH_TIME_ZONE created_at
    }
    shop_accounts {
        UUID shop_account_id PK
        VARCHAR_255 shop_name
        VARCHAR_255 contact_name
        VARCHAR_255 email
        VARCHAR_255 initial_password_hash
        BOOLEAN must_change_password
        VARCHAR_50 account_status
        UUID issued_by_se_admin_user_id FK
        TIMESTAMP_WITH_TIME_ZONE notification_sent_at
        BOOLEAN is_deleted
        TIMESTAMP_WITH_TIME_ZONE deleted_at
        TIMESTAMP_WITH_TIME_ZONE created_at
        TIMESTAMP_WITH_TIME_ZONE updated_at
    }
    audit_logs {
        UUID audit_log_id PK
        VARCHAR_50 operator_type
        UUID se_admin_user_id FK
        VARCHAR_100 action_type
        VARCHAR_100 target_type
        UUID target_id
        VARCHAR_50 result
        TEXT detail
        VARCHAR_45 ip_address
        TEXT user_agent
        TIMESTAMP_WITH_TIME_ZONE created_at
    }
    email_notification_logs {
        UUID email_notification_log_id PK
        UUID shop_account_id FK
        VARCHAR_255 to_email
        VARCHAR_100 notification_type
        VARCHAR_50 send_status
        TIMESTAMP_WITH_TIME_ZONE sent_at
        TEXT error_message
        SMALLINT retry_count
        TIMESTAMP_WITH_TIME_ZONE created_at
        TIMESTAMP_WITH_TIME_ZONE updated_at
    }
    se_admin_email_notification_logs {
        UUID se_admin_email_notification_log_id PK
        UUID se_admin_user_id FK
        VARCHAR_255 to_email
        VARCHAR_100 notification_type
        VARCHAR_50 send_status
        TIMESTAMP_WITH_TIME_ZONE sent_at
        TEXT error_message
        SMALLINT retry_count
        TIMESTAMP_WITH_TIME_ZONE created_at
        TIMESTAMP_WITH_TIME_ZONE updated_at
    }
    se_admin_users ||--o{ sessions : "1:N"
    se_admin_users ||--o{ shop_accounts : "1:N"
    se_admin_users ||--o{ audit_logs : "1:N"
    se_admin_users ||--o{ se_admin_email_notification_logs : "1:N"
    shop_accounts ||--o{ email_notification_logs : "1:N"
```