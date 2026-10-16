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
