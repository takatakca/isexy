import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useMemberSettings, type MemberSettings } from "@/hooks/useMemberSettings";

type ActivePrefs = Required<NonNullable<MemberSettings["activeStatus"]>>;
const DEFAULTS: ActivePrefs = { showActive: true, showRecentlyActive: true };

const ActiveStatus = () => {
  const { settings, loading, save } = useMemberSettings();
  const prefs: ActivePrefs = { ...DEFAULTS, ...settings.activeStatus };

  // Each switch saves right away (private member settings, see useMemberSettings).
  const update = async (patch: Partial<ActivePrefs>) => {
    const savedOnServer = await save({ activeStatus: { ...prefs, ...patch } });
    if (savedOnServer) toast.success("Active status saved");
    else toast.warning("Saved on this device only. We'll keep trying to sync it.");
  };

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Active Status</h1>
        <div className="bg-card rounded-lg">
          <div className="p-4 flex items-center justify-between">
            <label htmlFor="show-active-status" className="text-foreground font-medium">Show Active Status</label>
            <Switch
              id="show-active-status"
              checked={prefs.showActive}
              disabled={loading}
              onCheckedChange={(v) => update({ showActive: v })}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground px-1">
          Active status is displayed on your profile if you were active in the ISEXY app within the last 2 hours
        </p>

        <div className="bg-card rounded-lg mt-6">
          <div className="p-4 flex items-center justify-between">
            <label htmlFor="show-recently-active" className="text-foreground font-medium">Show Recently Active Status</label>
            <Switch
              id="show-recently-active"
              checked={prefs.showRecentlyActive}
              disabled={loading}
              onCheckedChange={(v) => update({ showRecentlyActive: v })}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground px-1">
          Recently Active status is displayed on your profile if you were active in the ISEXY app within the last 24 hours
        </p>
      </div>
    </AuthLayout>
  );
};

export default ActiveStatus;
