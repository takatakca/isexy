import { useState, useEffect } from "react";
import { Heart, MessageCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Allowance {
  weekly_super_likes: number;
  weekly_super_likes_max: number;
  weekly_first_impressions: number;
  weekly_first_impressions_max: number;
  weekly_reset_at: string;
  monthly_boosts: number;
  monthly_boosts_max: number;
  monthly_reset_at: string;
}

interface AllowancesCardProps {
  profileId: string;
}

export default function AllowancesCard({ profileId }: AllowancesCardProps) {
  const [allowance, setAllowance] = useState<Allowance | null>(null);

  useEffect(() => {
    if (!profileId) return;
    supabase
      .from("allowances")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAllowance(data as Allowance);
      });
  }, [profileId]);

  if (!allowance) return null;

  const items = [
    {
      label: "Super Likes",
      current: allowance.weekly_super_likes,
      max: allowance.weekly_super_likes_max,
      icon: <Heart className="w-4 h-4 text-blue-400 fill-blue-400" />,
      resetLabel: `Resets ${formatDistanceToNow(new Date(allowance.weekly_reset_at), { addSuffix: true })}`,
    },
    {
      label: "First Impressions",
      current: allowance.weekly_first_impressions,
      max: allowance.weekly_first_impressions_max,
      icon: <MessageCircle className="w-4 h-4 text-purple-400" />,
      resetLabel: `Resets ${formatDistanceToNow(new Date(allowance.weekly_reset_at), { addSuffix: true })}`,
    },
    {
      label: "Monthly Boosts",
      current: allowance.monthly_boosts,
      max: allowance.monthly_boosts_max,
      icon: <RefreshCw className="w-4 h-4 text-amber-400" />,
      resetLabel: `Resets ${formatDistanceToNow(new Date(allowance.monthly_reset_at), { addSuffix: true })}`,
    },
  ];

  const visibleItems = items.filter((i) => i.max > 0);
  if (visibleItems.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-bold text-foreground mb-3">Your Allowances</h3>
      <div className="space-y-3">
        {visibleItems.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {item.icon}
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {item.current}/{item.max}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${item.max > 0 ? (item.current / item.max) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{item.resetLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
