import { useState, useEffect } from "react";
import { X, Gift, Star, Phone, Package, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GiftPackage {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_usd: number;
  value_description: string | null;
  sort_order: number;
}

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
}

const categoryIcons: Record<string, any> = {
  stars: Star,
  phone_topup: Phone,
  food_package: Package,
  cash_donation: DollarSign,
};

const categoryLabels: Record<string, string> = {
  stars: "Stars",
  phone_topup: "Phone Recharge",
  food_package: "Food Package",
  cash_donation: "Cash Gift",
};

export function GiftModal({ isOpen, onClose, recipientId, recipientName }: GiftModalProps) {
  const { profile } = useAuth();
  const [packages, setPackages] = useState<GiftPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("stars");
  const [selectedPackage, setSelectedPackage] = useState<GiftPackage | null>(null);
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPackages();
    }
  }, [isOpen]);

  const fetchPackages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gift_packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      console.error("Error fetching packages:", error);
      toast.error("Failed to load gift packages");
    } else {
      setPackages((data as GiftPackage[]) || []);
    }
    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!selectedPackage || !profile) return;

    setProcessing(true);
    try {
      // Create gift transaction
      const { data: transaction, error: txError } = await supabase
        .from("gift_transactions")
        .insert({
          sender_profile_id: profile.id,
          receiver_profile_id: recipientId,
          gift_package_id: selectedPackage.id,
          amount_usd: selectedPackage.price_usd,
          message: message || null,
          status: "pending",
        })
        .select()
        .single();

      if (txError) throw txError;

      // Create Stripe checkout session
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        "create-one-time-payment",
        {
          body: {
            amount: Math.round(selectedPackage.price_usd * 100),
            productName: `Gift: ${selectedPackage.name} for ${recipientName}`,
            metadata: {
              type: "gift",
              transaction_id: (transaction as any).id,
              sender_id: profile.id,
              receiver_id: recipientId,
              package_id: selectedPackage.id,
            },
          },
        }
      );

      if (checkoutError) throw checkoutError;

      // Redirect to Stripe
      if (checkoutData?.url) {
        window.location.href = checkoutData.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Gift purchase error:", error);
      toast.error("Failed to process gift. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const categories = Array.from(new Set(packages.map(p => p.category)));
  const filteredPackages = packages.filter(p => p.category === selectedCategory);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-card w-full max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Send a Gift to {recipientName}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 p-4 overflow-x-auto">
          {categories.map((cat) => {
            const Icon = categoryIcons[cat] || Gift;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedPackage(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Icon className="w-4 h-4" />
                {categoryLabels[cat] || cat}
              </button>
            );
          })}
        </div>

        {/* Packages Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedPackage?.id === pkg.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-bold text-foreground">{pkg.name}</div>
                  <div className="text-lg font-bold text-primary mt-1">
                    ${pkg.price_usd.toFixed(2)}
                  </div>
                  {pkg.value_description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {pkg.value_description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message Input */}
        {selectedPackage && (
          <div className="px-4 pb-2">
            <Input
              placeholder="Add a personal message (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
            />
          </div>
        )}

        {/* Purchase Button */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={handlePurchase}
            disabled={!selectedPackage || processing}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : selectedPackage ? (
              <>
                Send ${selectedPackage.price_usd.toFixed(2)} Gift
              </>
            ) : (
              "Select a Gift"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
