import { mayConfirmTicket, mayEmailTicketAddress } from "../../../supabase/functions/_shared/ticket-confirmation-auth.ts";

Deno.test("ticket references cannot be used anonymously to send email", () => {
  if (mayConfirmTicket("user-1", null, false)) throw new Error("Anonymous sender authorized");
});
Deno.test("signed in member may confirm only their own support ticket", () => {
  if (!mayConfirmTicket("user-1", "user-1", false)) throw new Error("Ticket owner denied");
  if (mayConfirmTicket("user-1", "user-2", false)) throw new Error("Other member may trigger mail");
});
Deno.test("guest tickets are staff-only even if claimant knows a ticket number", () => {
  if (mayConfirmTicket(null, "user-1", false)) throw new Error("Guest ticket was claimed");
  if (!mayConfirmTicket(null, null, true)) throw new Error("Staff cannot confirm guest ticket");
});
Deno.test("a member's confirmation goes only to their own sign-in e-mail (0015 K2)", () => {
  if (!mayEmailTicketAddress("ana@example.com", "Ana@Example.com ", false)) throw new Error("Own address refused");
  if (mayEmailTicketAddress("victim@example.com", "ana@example.com", false)) throw new Error("Mail sent to someone else's address");
  if (mayEmailTicketAddress("victim@example.com", null, false)) throw new Error("Account without e-mail sent mail");
  if (mayEmailTicketAddress("+15145550123", "", false)) throw new Error("Phone contact treated as an address");
});
Deno.test("staff may confirm any ticket that has an e-mail address", () => {
  if (!mayEmailTicketAddress("guest@example.com", null, true)) throw new Error("Staff refused");
  if (mayEmailTicketAddress("no-email-on-file", null, true)) throw new Error("Non-address accepted");
});
