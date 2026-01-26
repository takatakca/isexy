import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Wallet, DollarSign, Smartphone, 
  Check, Clock, AlertCircle, ChevronRight, Coins,
  ArrowRight, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CashoutOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  minPoints: number;
  rate: number; // CUP per point
  description: string;
}

const cashoutOptions: CashoutOption[] = [
  {
    id: "transfermovil",
    name: "TransferMóvil",
    icon: <Smartphone className="w-6 h-6 text-blue-500" />,
    minPoints: 500,
    rate: 5, // 5 CUP per point
    description: "Instant transfer to your TransferMóvil account",
  },
  {
    id: "enzona",
    name: "EnZona",
    icon: <Wallet className="w-6 h-6 text-green-500" />,
    minPoints: 500,
    rate: 5,
    description: "Transfer to your EnZona wallet",
  },
];

interface CashoutHistory {
  id: string;
  amount: number;
  points: number;
  method: string;
  status: "pending" | "completed" | "failed";
  date: string;
}

const cashoutHistory: CashoutHistory[] = [
  { id: "1", amount: 2500, points: 500, method: "TransferMóvil", status: "completed", date: "22 Jan 2026" },
  { id: "2", amount: 5000, points: 1000, method: "EnZona", status: "completed", date: "15 Jan 2026" },
  { id: "3", amount: 1250, points: 250, method: "TransferMóvil", status: "pending", date: "Today" },
];

export default function CubanCashout() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [currentPoints, setCurrentPoints] = useState(1850);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pointsToRedeem, setPointsToRedeem] = useState("");
  const [step, setStep] = useState<"select" | "details" | "confirm">("select");

  const selectedOption = cashoutOptions.find(o => o.id === selectedMethod);
  const cupAmount = selectedOption ? parseInt(pointsToRedeem || "0") * selectedOption.rate : 0;

  const handleCashout = () => {
    const points = parseInt(pointsToRedeem);
    if (!selectedOption || !points || points < selectedOption.minPoints) {
      toast.error(`Minimum cashout is ${selectedOption?.minPoints || 500} points`);
      return;
    }
    if (points > currentPoints) {
      toast.error("Not enough points");
      return;
    }

    setCurrentPoints(prev => prev - points);
    toast.success(`Cashout of ${cupAmount.toLocaleString()} CUP initiated!`);
    setStep("select");
    setSelectedMethod(null);
    setPointsToRedeem("");
    setPhoneNumber("");
  };

  const handleQuickSelect = (points: number) => {
    setPointsToRedeem(points.toString());
  };

  if (step === "details" && selectedOption) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep("select")} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">{selectedOption.name}</h1>
          </div>
        </header>

        <div className="px-4 py-6">
          {/* Current Balance */}
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground">Available Points</p>
            <p className="text-3xl font-bold text-foreground">{currentPoints.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">≈ {(currentPoints * selectedOption.rate).toLocaleString()} CUP</p>
          </div>

          {/* Amount Input */}
          <div className="bg-card rounded-xl border border-border p-4 mb-4">
            <Label className="text-foreground font-medium mb-2 block">Points to Cash Out</Label>
            <Input
              type="number"
              value={pointsToRedeem}
              onChange={(e) => setPointsToRedeem(e.target.value)}
              placeholder={`Min: ${selectedOption.minPoints} points`}
              className="text-lg"
            />
            <p className="text-sm text-muted-foreground mt-2">
              You'll receive: <span className="font-bold text-primary">{cupAmount.toLocaleString()} CUP</span>
            </p>

            {/* Quick Select */}
            <div className="flex gap-2 mt-3">
              {[500, 1000, 1500].filter(p => p <= currentPoints).map(points => (
                <button
                  key={points}
                  onClick={() => handleQuickSelect(points)}
                  className="flex-1 py-2 px-3 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted/80"
                >
                  {points}
                </button>
              ))}
              <button
                onClick={() => handleQuickSelect(currentPoints)}
                className="flex-1 py-2 px-3 bg-primary/10 rounded-lg text-sm font-medium text-primary hover:bg-primary/20"
              >
                Max
              </button>
            </div>
          </div>

          {/* Phone Number */}
          <div className="bg-card rounded-xl border border-border p-4 mb-6">
            <Label className="text-foreground font-medium mb-2 block">Phone Number</Label>
            <Input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+53 5XXX XXXX"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter the phone number linked to your {selectedOption.name} account
            </p>
          </div>

          {/* Rate Info */}
          <div className="bg-muted/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-foreground">Exchange Rate</span>
            </div>
            <p className="text-sm text-muted-foreground">
              1 Point = {selectedOption.rate} CUP • Minimum: {selectedOption.minPoints} points
            </p>
          </div>

          <Button
            onClick={handleCashout}
            disabled={!phoneNumber || !pointsToRedeem || parseInt(pointsToRedeem) < selectedOption.minPoints}
            className="w-full py-6 gradient-primary text-lg font-bold"
          >
            Cash Out {cupAmount.toLocaleString()} CUP
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Cashout - Pesos Cubanos</h1>
        </div>
      </header>

      {/* Balance Card */}
      <div className="px-4 py-6">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <Coins className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm text-white/80">Your Points Balance</p>
              <p className="text-3xl font-bold">{currentPoints.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center justify-between bg-white/20 rounded-xl p-3">
            <span className="text-sm">Estimated Value</span>
            <span className="font-bold">{(currentPoints * 5).toLocaleString()} CUP</span>
          </div>
        </div>
      </div>

      {/* Cashout Methods */}
      <div className="px-4 pb-6">
        <h3 className="font-bold text-foreground mb-3">Select Cashout Method</h3>
        <div className="space-y-3">
          {cashoutOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setSelectedMethod(option.id);
                setStep("details");
              }}
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  {option.icon}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">{option.name}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* Info Card */}
      <div className="px-4 pb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground mb-1">Exclusive for Cuban Users</p>
              <p className="text-sm text-muted-foreground">
                This cashout feature is available exclusively for verified Cuban users. 
                Points can be converted to CUP and transferred directly to your mobile wallet.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cashout History */}
      <div className="px-4 pb-8">
        <h3 className="font-bold text-foreground mb-3">Cashout History</h3>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {cashoutHistory.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  item.status === "completed" ? "bg-green-100" : 
                  item.status === "pending" ? "bg-amber-100" : "bg-red-100"
                }`}>
                  {item.status === "completed" ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : item.status === "pending" ? (
                    <Clock className="w-5 h-5 text-amber-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.amount.toLocaleString()} CUP</p>
                  <p className="text-xs text-muted-foreground">{item.method} • {item.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">-{item.points} pts</p>
                <p className={`text-xs capitalize ${
                  item.status === "completed" ? "text-green-500" :
                  item.status === "pending" ? "text-amber-500" : "text-red-500"
                }`}>
                  {item.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
