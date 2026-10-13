import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMemberSettings, type MemberSettings } from "@/hooks/useMemberSettings";

type EmailPrefs = Required<NonNullable<MemberSettings["email"]>>;
const DEFAULTS: EmailPrefs = { newMatches: true, newMessages: true, promotions: true };

const EmailSettings = () => {
  const { user } = useAuth();
  const { settings, loading, save } = useMemberSettings();
  const prefs: EmailPrefs = { ...DEFAULTS, ...settings.email };

  // Each switch saves right away (private member settings, see useMemberSettings).
  const update = async (patch: Partial<EmailPrefs>, message = "Email preferences saved") => {
    const savedOnServer = await save({ email: { ...prefs, ...patch } });
    if (savedOnServer) toast.success(message);
    else toast.warning("Saved on this device only. We'll keep trying to sync it.");
  };

  const handleUnsubscribeAll = () =>
    update({ newMatches: false, newMessages: false, promotions: false }, "You're unsubscribed from all emails");

  // Takatak Auth: members who signed in by SMS may have no email at all.
  const email = user?.email;
  const emailConfirmed = !!user?.email_confirmed_at;

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4">
        <h1 className="text-2xl font-bold text-foreground mb-2">Email</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Control the emails you want to get - all of them, just the important stuff or the bare minimum. You can always unsubscribe from the bottom of any email.
        </p>

        <div className="bg-card rounded-lg mb-2">
          <div className="p-4 flex items-center justify-between gap-3 border-b border-border">
            <span className="text-foreground break-all">{email || "No email on your account"}</span>
            {email && emailConfirmed && <Check className="h-5 w-5 text-primary shrink-0" />}
          </div>
          <div className="p-4">
            <span className="text-muted-foreground text-sm">
              {email
                ? emailConfirmed
                  ? "Verified email address"
                  : "This address is confirmed the next time you sign in with an email code."
                : "You signed in with your phone. Sign in with Google or an email code to receive emails."}
            </span>
          </div>
        </div>

        <div className="bg-card rounded-lg mt-4">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <label htmlFor="email-new-matches" className="text-foreground">New Matches</label>
            <Switch id="email-new-matches" checked={prefs.newMatches} disabled={loading} onCheckedChange={(v) => update({ newMatches: v })} />
          </div>
          <div className="p-4 flex items-center justify-between border-b border-border">
            <label htmlFor="email-new-messages" className="text-foreground">New Messages</label>
            <Switch id="email-new-messages" checked={prefs.newMessages} disabled={loading} onCheckedChange={(v) => update({ newMessages: v })} />
          </div>
          <div className="p-4 flex items-center justify-between gap-4">
            <label htmlFor="email-promotions">
              <span className="text-foreground block">Promotions</span>
              <span className="text-sm text-muted-foreground">
                I want to receive news, updates and offers from ISEXY
              </span>
            </label>
            <Switch id="email-promotions" checked={prefs.promotions} disabled={loading} onCheckedChange={(v) => update({ promotions: v })} />
          </div>
        </div>

        <button
          onClick={handleUnsubscribeAll}
          disabled={loading || (!prefs.newMatches && !prefs.newMessages && !prefs.promotions)}
          className="w-full py-3 text-foreground text-sm font-medium mt-4 disabled:opacity-50"
        >
          UNSUBSCRIBE FROM ALL
        </button>
      </div>
    </AuthLayout>
  );
};

export default EmailSettings;
