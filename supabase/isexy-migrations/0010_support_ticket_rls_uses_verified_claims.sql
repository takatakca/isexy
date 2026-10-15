-- The old support ticket policies queried auth.users directly as the member.
-- Members cannot read auth.users, so their own ticket queries/updates failed.
-- Use only trusted JWT claims and ISEXY-owned ticket columns.
SET LOCAL search_path = isexy, extensions;

DROP POLICY IF EXISTS "Users can update own tickets" ON isexy.support_tickets;
CREATE POLICY "Users can update own tickets"
ON isexy.support_tickets FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (email = (SELECT auth.jwt() ->> 'email')
      AND (SELECT auth.uid()) IS NOT NULL)
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR (email = (SELECT auth.jwt() ->> 'email')
      AND (SELECT auth.uid()) IS NOT NULL)
);

DROP POLICY IF EXISTS "Users can view own tickets by email" ON isexy.support_tickets;
CREATE POLICY "Users can view own tickets by email"
ON isexy.support_tickets FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (email = (SELECT auth.jwt() ->> 'email')
      AND (SELECT auth.uid()) IS NOT NULL)
);

-- Administrative access continues through the separate existing staff
-- policies. Anonymous users still cannot enumerate support requests.
