import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, TrendingUp, TrendingDown, Wallet, ArrowRight, Loader2, Gift, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface StarTransaction {
  id: string;
  sender_profile_id: string;
  receiver_profile_id: string;
  stars_amount: number;
  usd_value: number;
  transaction_type: string;
  created_at: string;
  sender_profile?: { first_name: string };
  receiver_profile?: { first_name: string };
}

interface CashoutRequest {
  id: string;
  stars_amount: number;
  usd_amount: number;
  status: string;
  cashout_method: string;
  created_at: string;
}

export default function MyStars() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [starsBalance, setStarsBalance] = useState(0);
  const [lifetimeReceived, setLifetimeReceived] = useState(0);
  const [transactions, setTransactions] = useState<StarTransaction[]>([]);
  const [cashoutRequests, setCashoutRequests] = useState<CashoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCashout, setShowCashout] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState("");
  const [cashoutMethod, setCashoutMethod] = useState("mobile_topup");
  const [processingCashout, setProcessingCashout] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchStarsData();
    }
  }, [profile?.id]);

  const fetchStarsData = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      // Fetch stars balance
      const { data: starsData } = await supabase
        .from("user_stars")
        .select("*")
        .eq("profile_id", profile.id)
        .single();

      if (starsData) {
        setStarsBalance((starsData as any).stars_balance || 0);
        setLifetimeReceived((starsData as any).lifetime_stars_received || 0);
      }

      // Fetch transactions
      const { data: txData } = await supabase
        .from("star_transactions")
        .select(`
          *,
          sender_profile:profiles!star_transactions_sender_profile_id_fkey(first_name),
          receiver_profile:profiles!star_transactions_receiver_profile_id_fkey(first_name)
        `)
        .or(`sender_profile_id.eq.${profile.id},receiver_profile_id.eq.${profile.id}`)
        .order("created_at", { ascending: false })
        .limit(20);

      setTransactions((txData as StarTransaction[]) || []);

      // Fetch cashout requests
      const { data: cashoutData } = await supabase
        .from("star_cashout_requests")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setCashoutRequests((cashoutData as CashoutRequest[]) || []);
    } catch (error) {
      console.error("Error fetching stars data:", error);
    } finally {
      setLoading(false);
    }
  };

  const usdValue = (starsBalance * 0.01).toFixed(2);
  const minCashout = 1000;

  const handleCashout = async () => {
    const amount = parseInt(cashoutAmount);
    if (!amount || amount < minCashout || amount > starsBalance) {
      toast.error(`Please enter a valid amount (minimum ${minCashout} stars)`);
      return;
    }

    setProcessingCashout(true);
    try {
      const { error } = await supabase.from("star_cashout_requests").insert({
        profile_id: profile!.id,
        stars_amount: amount,
        usd_amount: amount * 0.01,
        cashout_method: cashoutMethod,
        cashout_details: {
          method: cashoutMethod,
          requestedAt: new Date().toISOString(),
        },
      });

      if (error) throw error;

      toast.success("Cashout request submitted! We'll process it within 3-5 business days.");
      setShowCashout(false);
      setCashoutAmount("");
      fetchStarsData();
    } catch (error: any) {
      console.error("Cashout error:", error);
      toast.error("Failed to submit cashout request");
    } finally {
      setProcessingCashout(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-8">
      {/* Header */}
      <header className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white p-6 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/20 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">My Stars</h1>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <Star className="w-8 h-8 fill-current" />
            <span className="text-5xl font-bold">{starsBalance.toLocaleString()}</span>
          </div>
          <p className="text-white/80">≈ ${usdValue} USD value</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="px-4 -mt-12">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 text-green-500 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">Received</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{lifetimeReceived.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Lifetime stars</p>
          </div>

          <div className="bg-card rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Wallet className="w-5 h-5" />
              <span className="text-sm font-medium">Available</span>
            </div>
            <p className="text-2xl font-bold text-foreground">${usdValue}</p>
            <p className="text-xs text-muted-foreground">To cash out</p>
          </div>
        </div>
      </div>

      {/* Cashout Button */}
      {starsBalance >= minCashout && (
        <div className="px-4 mt-4">
          <Button 
            onClick={() => setShowCashout(true)}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Cash Out Stars
          </Button>
        </div>
      )}

      {/* Pending Cashouts */}
      {cashoutRequests.some(c => c.status === "pending" || c.status === "processing") && (
        <div className="px-4 mt-4">
          <h3 className="font-bold text-foreground mb-2">Pending Cashouts</h3>
          {cashoutRequests
            .filter(c => c.status === "pending" || c.status === "processing")
            .map(request => (
              <div key={request.id} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 mb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {request.stars_amount.toLocaleString()} stars
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${request.usd_amount.toFixed(2)} via {request.cashout_method.replace("_", " ")}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full capitalize">
                    {request.status}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Transaction History */}
      <div className="px-4 mt-6">
        <h3 className="font-bold text-foreground mb-3">Recent Activity</h3>
        
        {transactions.length === 0 ? (
          <div className="text-center py-10 bg-card rounded-xl">
            <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No star transactions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Stars you receive will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => {
              const isReceived = tx.receiver_profile_id === profile?.id;
              return (
                <div key={tx.id} className="bg-card rounded-xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isReceived ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  }`}>
                    {isReceived ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {isReceived 
                        ? `From ${(tx.sender_profile as any)?.first_name || "User"}`
                        : `To ${(tx.receiver_profile as any)?.first_name || "User"}`
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div className={`text-right ${isReceived ? "text-green-600" : "text-red-600"}`}>
                    <p className="font-bold">{isReceived ? "+" : "-"}{tx.stars_amount}</p>
                    <p className="text-xs">≈ ${tx.usd_value.toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="px-4 mt-6">
        <div className="bg-primary/10 rounded-xl p-4">
          <h4 className="font-bold text-primary mb-2">How Stars Work</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Receive stars from matches as appreciation</li>
            <li>• 100 Stars = $1.00 USD value</li>
            <li>• Minimum 1,000 stars to cash out</li>
            <li>• Cashouts processed in 3-5 business days</li>
          </ul>
        </div>
      </div>

      {/* Cashout Modal */}
      {showCashout && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Cash Out Stars</h2>
            
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground block mb-2">
                Amount to cash out
              </label>
              <input
                type="number"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(e.target.value)}
                placeholder={`Min ${minCashout} stars`}
                max={starsBalance}
                className="w-full p-3 rounded-xl border border-border bg-background text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: {starsBalance.toLocaleString()} stars (${(starsBalance * 0.01).toFixed(2)})
              </p>
            </div>

            <div className="mb-6">
              <label className="text-sm font-medium text-foreground block mb-2">
                Cashout Method
              </label>
              <select
                value={cashoutMethod}
                onChange={(e) => setCashoutMethod(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-background text-foreground"
              >
                <option value="mobile_topup">Mobile Top-up</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="western_union">Western Union</option>
              </select>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCashout(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleCashout} 
                disabled={processingCashout}
                className="flex-1"
              >
                {processingCashout ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
