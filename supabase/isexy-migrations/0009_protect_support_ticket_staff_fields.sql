-- Users may add details to their support requests, but only staff may change
-- ticket status, identity, ownership, routing, or staff responses.
-- ISEXY-only: no writes to shared TAKATAK Auth or public tables.
SET LOCAL search_path = isexy, extensions;

CREATE OR REPLACE FUNCTION isexy.protect_support_ticket_staff_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() = 'service_role'
     OR isexy.has_role(auth.uid(), 'admin'::isexy.app_role) THEN
    RETURN NEW;
  END IF;

  -- Exempt only user-editable request details. All new columns are
  -- automatically staff-only unless deliberately allowlisted here.
  IF (to_jsonb(NEW) - ARRAY['message', 'attachments', 'updated_at']::text[])
       IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['message', 'attachments', 'updated_at']::text[]) THEN
    RAISE EXCEPTION 'Only ISEXY staff can modify ticket administrative fields'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS isexy_support_ticket_staff_fields_guard ON isexy.support_tickets;
CREATE TRIGGER isexy_support_ticket_staff_fields_guard
BEFORE UPDATE ON isexy.support_tickets
FOR EACH ROW EXECUTE FUNCTION isexy.protect_support_ticket_staff_fields();

REVOKE ALL ON FUNCTION isexy.protect_support_ticket_staff_fields()
  FROM PUBLIC, anon, authenticated;
