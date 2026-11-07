// A ticket number is a tracking reference, not proof of ownership.
// Anonymous tickets require a real staff action to send mail.
export function mayConfirmTicket(
  ticketUserId: string | null,
  authenticatedUserId: string | null,
  isTrustedStaff: boolean,
): boolean {
  if (isTrustedStaff) return true;
  return !!ticketUserId && !!authenticatedUserId &&
    ticketUserId === authenticatedUserId;
}

// The confirmation goes to the ticket's address. A member may only have it
// sent to their own sign-in e-mail (0015 K2 makes members file under it; this
// also covers tickets filed before that rule). Staff may confirm any ticket.
export function mayEmailTicketAddress(
  ticketEmail: string | null,
  accountEmail: string | null | undefined,
  isTrustedStaff: boolean,
): boolean {
  const to = (ticketEmail ?? "").trim().toLowerCase();
  if (!to.includes("@")) return false; // phone-only contacts: nothing to send
  if (isTrustedStaff) return true;
  const own = (accountEmail ?? "").trim().toLowerCase();
  return own.length > 0 && to === own;
}
