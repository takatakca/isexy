import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, Heart, Smartphone, ShoppingBag, DollarSign, 
  Gift, CreditCard, Check, Loader2, User, Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DonationOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  basePrice: number;
  options?: { label: string; value: number }[];
}

const donationOptions: DonationOption[] = [
  {
    id: "topup",
    name: "Mobile Top-Up",
    description: "Recharge their Cuban mobile phone",
    icon: <Smartphone className="w-6 h-6 text-blue-500" />,
    basePrice: 0,
    options: [
      { label: "$10 USD", value: 10 },
      { label: "$20 USD", value: 20 },
      { label: "$30 USD", value: 30 },
      { label: "$50 USD", value: 50 },
    ],
  },
  {
    id: "food",
    name: "Food Package",
    description: "Send essential food items to their family",
    icon: <ShoppingBag className="w-6 h-6 text-green-500" />,
    basePrice: 0,
    options: [
      { label: "Basic Pack - $25", value: 25 },
      { label: "Family Pack - $50", value: 50 },
      { label: "Premium Pack - $100", value: 100 },
    ],
  },
  {
    id: "cash",
    name: "Cash Donation",
    description: "Direct monetary gift to support them",
    icon: <DollarSign className="w-6 h-6 text-yellow-500" />,
    basePrice: 0,
    options: [
      { label: "$5 USD", value: 5 },
      { label: "$10 USD", value: 10 },
      { label: "$25 USD", value: 25 },
      { label: "$50 USD", value: 50 },
      { label: "$100 USD", value: 100 },
    ],
  },
];

const foodPackages = {
  basic: [
    "5 lbs Rice",
    "2 lbs Beans",
    "1L Cooking Oil",
    "2 lbs Sugar",
    "1 lb Coffee",
  ],
  family: [
    "10 lbs Rice",
    "5 lbs Beans",
    "2L Cooking Oil",
    "5 lbs Sugar",
    "2 lbs Coffee",
    "Pasta & Sauce",
    "Canned Goods",
  ],
  premium: [
    "20 lbs Rice",
    "10 lbs Beans",
    "4L Cooking Oil",
    "10 lbs Sugar",
    "3 lbs Coffee",
    "Pasta & Sauce",
    "Canned Goods",
    "Hygiene Products",
    "Chicken/Meat",
  ],
};

export default function CubanDonations() {
  const navigate = useNavigate();
  const { recipientId } = useParams();
  const { profile } = useAuth();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<"select" | "details" | "confirm">("select");

  const selectedDonation = donationOptions.find(o => o.id === selectedOption);
  const finalAmount = selectedAmount || parseInt(customAmount) || 0;

  const handleProceed = () => {
    if (!selectedOption || finalAmount <= 0) {
      toast.error("Please select a donation type and amount");
      return;
    }
    setStep("details");
  };

  const handleConfirm = async () => {
    if (selectedOption === "topup" && !phoneNumber) {
      toast.error("Please enter the phone number");
      return;
    }

    setProcessing(true);

    try {
      // Create Stripe checkout session
      const { data, error } = await supabase.functions.invoke("create-one-time-payment", {
        body: {
          amount: finalAmount * 100, // Convert to cents
          currency: "usd",
          description: `${selectedDonation?.name} for Cuban user`,
          metadata: {
            type: selectedOption,
            recipientId: recipientId || null,
            phoneNumber: phoneNumber || null,
            donorId: profile?.id,
          },
          successUrl: `${window.location.origin}/donation-success`,
          cancelUrl: window.location.href,
        },
      });

      if (error) throw error;

      // Redirect to Stripe Checkout
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      toast.error("Failed to process payment. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (step === "details" && selectedDonation) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep("select")} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">{selectedDonation.name}</h1>
          </div>
        </header>

        <div className="px-4 py-6 space-y-6">
          {/* Amount Summary */}
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-1">You're sending</p>
              <p className="text-4xl font-bold text-foreground">${finalAmount} USD</p>
              <p className="text-sm text-muted-foreground mt-2">{selectedDonation.description}</p>
            </CardContent>
          </Card>

          {/* Phone Number for Top-Up */}
          {selectedOption === "topup" && (
            <div className="space-y-2">
              <Label className="text-foreground">Cuban Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+53 5XXX XXXX"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the phone number to receive the top-up
              </p>
            </div>
          )}

          {/* Food Package Contents */}
          {selectedOption === "food" && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-green-500" />
                  Package Contents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(finalAmount === 25 ? foodPackages.basic : 
                    finalAmount === 50 ? foodPackages.family : 
                    foodPackages.premium).map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Recipient Name (optional) */}
          <div className="space-y-2">
            <Label className="text-foreground">Recipient Name (Optional)</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Their name"
                className="pl-10"
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Gift className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">Secure & Direct</p>
                <p className="text-sm text-muted-foreground">
                  Your donation goes directly to help the person you're supporting. 
                  We use trusted local partners in Cuba to deliver goods and services.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={processing || (selectedOption === "topup" && !phoneNumber)}
            className="w-full py-6 gradient-primary text-lg font-bold"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pay ${finalAmount} USD
              </>
            )}
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
          <div>
            <h1 className="text-xl font-bold text-foreground">Support a Cuban</h1>
            <p className="text-sm text-muted-foreground">Show your appreciation</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="px-4 py-6">
        <div className="bg-gradient-to-br from-red-500 via-primary to-blue-600 rounded-2xl p-6 text-white text-center">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Make a Difference</h2>
          <p className="text-white/80 text-sm">
            Help improve someone's life in Cuba with a thoughtful gift
          </p>
        </div>
      </div>

      {/* Donation Options */}
      <div className="px-4 space-y-4">
        <h3 className="font-bold text-foreground">Choose How to Help</h3>
        
        {donationOptions.map((option) => (
          <Card
            key={option.id}
            className={`bg-card border transition-all cursor-pointer ${
              selectedOption === option.id 
                ? "border-primary ring-2 ring-primary/20" 
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => {
              setSelectedOption(option.id);
              setSelectedAmount(null);
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  {option.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{option.name}</h4>
                  <p className="text-sm text-muted-foreground mb-3">{option.description}</p>
                  
                  {selectedOption === option.id && option.options && (
                    <RadioGroup
                      value={selectedAmount?.toString()}
                      onValueChange={(value) => setSelectedAmount(parseInt(value))}
                      className="grid grid-cols-2 gap-2"
                    >
                      {option.options.map((opt) => (
                        <div key={opt.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt.value.toString()} id={`${option.id}-${opt.value}`} />
                          <Label htmlFor={`${option.id}-${opt.value}`} className="text-sm cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {selectedOption === option.id && option.id === "cash" && (
                    <div className="mt-3">
                      <Input
                        type="number"
                        placeholder="Or enter custom amount"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setSelectedAmount(null);
                        }}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Proceed Button */}
      {selectedOption && finalAmount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border">
          <Button
            onClick={handleProceed}
            className="w-full py-6 gradient-primary text-lg font-bold"
          >
            Continue with ${finalAmount} USD
          </Button>
        </div>
      )}

      {/* Bottom padding for fixed button */}
      {selectedOption && finalAmount > 0 && <div className="h-24" />}
    </div>
  );
}
