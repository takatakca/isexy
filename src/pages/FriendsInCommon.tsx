import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Switch } from "@/components/ui/switch";
import { useDeviceSetting } from "@/hooks/useDeviceSetting";

const FriendsInCommon = () => {
  const [enableFriendsInCommon, setEnableFriendsInCommon] = useDeviceSetting("friends_in_common_enabled", false);

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4">
        <div className="bg-card rounded-lg">
          <div className="p-4 flex items-center justify-between">
            <div>
              <span className="text-foreground font-medium block">Enable Friends in Common</span>
              <span className="text-sm text-muted-foreground">Contacts not uploaded</span>
            </div>
            <Switch
              checked={enableFriendsInCommon}
              onCheckedChange={setEnableFriendsInCommon}
              aria-label="Enable Friends in Common"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-4 px-1">
          You and your contacts may be counted as mutuals for other ISEXY members who enable Friends in Common.{" "}
          <Link to="/faq" className="text-primary">Learn More</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default FriendsInCommon;
