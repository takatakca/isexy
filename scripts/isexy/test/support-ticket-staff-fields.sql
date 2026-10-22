-- Test an authenticated member can update their message but cannot mark
-- their support request resolved, forge an admin response, or transfer it.
BEGIN;

INSERT INTO auth.users(id, email)
VALUES ('a1111111-1111-4111-8111-111111111111', 'ci-ticket-member@example.invalid');
INSERT INTO isexy.support_tickets(
  ticket_number, user_id, name, email, subject, category, message
) VALUES (
  'CI-TICKET-GUARD',
  'a1111111-1111-4111-8111-111111111111',
  'Test Member', 'ci-ticket-member@example.invalid',
  'Billing issue', 'Payments', 'Original request'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $checks$
BEGIN
  UPDATE isexy.support_tickets
    SET message = 'Additional details'
    WHERE ticket_number = 'CI-TICKET-GUARD';
  IF NOT EXISTS (
    SELECT 1 FROM isexy.support_tickets
    WHERE ticket_number = 'CI-TICKET-GUARD'
      AND message = 'Additional details'
  ) THEN
    RAISE EXCEPTION 'Member cannot update own ticket details';
  END IF;

  BEGIN
    UPDATE isexy.support_tickets
      SET status = 'resolved'
      WHERE ticket_number = 'CI-TICKET-GUARD';
    RAISE EXCEPTION 'Member changed ticket status';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE isexy.support_tickets
      SET response = 'Fake staff reply'
      WHERE ticket_number = 'CI-TICKET-GUARD';
    RAISE EXCEPTION 'Member forged a staff reply';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE isexy.support_tickets
      SET email = 'attacker@example.invalid'
      WHERE ticket_number = 'CI-TICKET-GUARD';
    RAISE EXCEPTION 'Member changed ticket email';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF (SELECT status FROM isexy.support_tickets
      WHERE ticket_number = 'CI-TICKET-GUARD') <> 'open' THEN
    RAISE EXCEPTION 'Ticket status was changed';
  END IF;
END;
$checks$;

ROLLBACK;
