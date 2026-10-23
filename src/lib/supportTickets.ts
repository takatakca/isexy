import type { User } from "@supabase/supabase-js";

/**
 * The contact a signed-in member's support ticket is filed under. The database
 * refuses any other (0015 K2): a member writes from their sign-in e-mail, and a
 * phone-only account (no e-mail) files with its phone number, so our replies
 * reach it in Ticket Tracking only. Guests type their own address; tracking a
 * guest ticket by number + e-mail then shows its status only.
 */
export function memberTicketContact(user: Pick<User, "email" | "phone">): { contact: string; isEmail: boolean } {
  const email = user.email?.trim().toLowerCase();
  if (email) return { contact: email, isEmail: true };
  // support_tickets.email needs 3+ characters.
  return { contact: user.phone ? `+${user.phone.replace(/^\+/, "")}` : "no-email-on-file", isEmail: false };
}
