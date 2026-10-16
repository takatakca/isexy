import { mayConfirmTicket } from "../../../supabase/functions/_shared/ticket-confirmation-auth.ts";

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
