-- 監査ログの改ざん防止（BP-012 備考）
-- audit_logs は INSERT のみを許可し、UPDATE / DELETE をDB層でも拒否する。
-- 保持期間超過レコードの自動削除バッチ（deleteExpiredAuditLogs）のみ、
-- トランザクションローカル設定 app.audit_log_delete_allowed を明示的に 'on' にした上で削除を行う。
CREATE OR REPLACE FUNCTION audit_logs_prevent_tamper() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs is append-only: UPDATE is not allowed';
  ELSIF TG_OP = 'DELETE' THEN
    IF current_setting('app.audit_log_delete_allowed', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'audit_logs is append-only: DELETE is not allowed outside the retention cleanup batch';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_prevent_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_prevent_tamper();
--> statement-breakpoint
CREATE TRIGGER audit_logs_prevent_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_prevent_tamper();
