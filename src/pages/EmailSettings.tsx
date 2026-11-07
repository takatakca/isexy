import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { loadNotificationSettings, saveNotificationSettings, type NotificationSettings } from "@/lib/notificationSettings";

type EmailPrefs = Required<NonNullable<NotificationSettings["email"]>>;
const DEFAULTS: EmailPrefs = { new_matches: true, new_messages: true, promotions: true };

const EmailSettings = () => {
  const { user } = useAuth();
  const { language, autoTranslate } = useLanguage();
  const [prefs, setPrefs] = useState<EmailPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const userId = user?.id;

  // Phone sign-ins get a placeholder address that never receives mail.
  const email = user?.email && !user.email.endsWith("@phone.isexy.ca") ? user.email : null;
  const verified = !!user?.email_confirmed_at;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadNotificationSettings(userId).then((stored) => {
      if (cancelled) return;
      setPrefs({ ...DEFAULTS, ...(stored?.email ?? {}) });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  /** Save immediately; roll back and say so if it fails. */
  const update = async (patch: Partial<EmailPrefs>) => {
    if (!userId) return;
    const previous = prefs;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    const ok = await saveNotificationSettings(userId, "email", next, {
      preferred_language: language.code,
      auto_translate: autoTranslate,
    });
    setSaving(false);
    if (!ok) {
      setPrefs(previous);
      toast.error("Couldn't save your email settings. Please try again.");
    }
  };

  const disabled = loading || !userId || !email;

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Choose which emails ISEXY sends you. Changes are saved right away.
        </p>

        <div className="bg-card rounded-lg mb-2">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <span className="text-foreground break-all">{email ?? "No email address on this account"}</span>
            {email && verified && <Check className="h-5 w-5 text-primary shrink-0" aria-label="Verified" />}
          </div>
          <div className="p-4">
            <span className="text-sm text-muted-foreground">
              {!email
                ? "You signed in with your phone number, so we don't send you emails."
                : verified
                  ? "Verified email address"
                  : "Not verified yet: sign in with an email code to verify it."}
            </span>
          </div>
        </div>

        <div className="bg-card rounded-lg mt-4" aria-busy={loading || saving}>
          <div className="p-4 flex items-center justify-between border-b border-border">
            <span className="text-foreground">New Matches</span>
            <Switch checked={prefs.new_matches} disabled={disabled} onCheckedChange={(v) => void update({ new_matches: v })} aria-label="New matches emails" />
          </div>
          <div className="p-4 flex items-center justify-between border-b border-border">
            <span className="text-foreground">New Messages</span>
            <Switch checked={prefs.new_messages} disabled={disabled} onCheckedChange={(v) => void update({ new_messages: v })} aria-label="New messages emails" />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <span className="text-foreground block">Promotions</span>
              <span className="text-sm text-muted-foreground">
                I want to receive news, updates and offers from ISEXY
              </span>
            </div>
            <Switch checked={prefs.promotions} disabled={disabled} onCheckedChange={(v) => void update({ promotions: v })} aria-label="Promotional emails" />
          </div>
        </div>

        <button
          onClick={() => void update({ new_matches: false, new_messages: false, promotions: false })}
          disabled={disabled}
          className="w-full py-3 text-foreground text-sm font-medium mt-4 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          UNSUBSCRIBE FROM ALL
        </button>
      </div>
    </AuthLayout>
  );
};

export default EmailSettings;
