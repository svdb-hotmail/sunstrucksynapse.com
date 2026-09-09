CREATE TABLE "submission_invitation_issuance_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_invitation_issuance_audit_invitation_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."submission_invitations"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "submission_invitation_issuance_audit_actor_id_check" CHECK (nullif(btrim("actor_id"), '') is not null),
	CONSTRAINT "submission_invitation_issuance_audit_actor_email_check" CHECK (position('@' in "actor_email") > 1 and nullif(btrim("actor_email"), '') is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "submission_invitation_issuance_audit_invitation_unique" ON "submission_invitation_issuance_audit" USING btree ("invitation_id");
--> statement-breakpoint
CREATE INDEX "submission_invitation_issuance_audit_actor_idx" ON "submission_invitation_issuance_audit" USING btree ("actor_email", "issued_at");
--> statement-breakpoint
CREATE FUNCTION "prevent_submission_invitation_issuance_audit_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Submission invitation issuance audit records are immutable.';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "submission_invitation_issuance_audit_immutable"
BEFORE UPDATE OR DELETE ON "submission_invitation_issuance_audit"
FOR EACH ROW EXECUTE FUNCTION "prevent_submission_invitation_issuance_audit_mutation"();
