import { AuthLayout } from "@/components/AuthLayout";
import { Shield, AlertTriangle, Users, MapPin, Phone, DollarSign } from "lucide-react";

const safetyTips = [
  {
    icon: DollarSign,
    title: "Never send money or share financial information",
    description:
      "Never send money, whether it's through wire transfer, banking service, or an app on your phone, even if the person claims to be in an emergency.",
  },
  {
    icon: Shield,
    title: "Protect your personal information",
    description:
      "Never share personal information, such as your social security number, home or work address, or details about your daily routine with people you don't know.",
  },
  {
    icon: Phone,
    title: "Stay on the platform",
    description:
      "Keep conversations on CubaDate while you're getting to know someone. Users with bad intentions often try to move the conversation to text, messaging apps, email, or phone right away.",
  },
  {
    icon: AlertTriangle,
    title: "Be wary of long distance relationships",
    description:
      "Watch out for scammers who claim to be from your country but stuck somewhere else, especially if they ask for financial help to return home.",
  },
  {
    icon: Users,
    title: "Report suspicious behavior",
    description:
      "Block and report anyone that violates our terms or your personal boundaries. This includes requests for money, harassment, threats, and abusive messages.",
  },
  {
    icon: MapPin,
    title: "Meet in public places",
    description:
      "Meet in a populated, public place — never at your home, your date's home, or any other private location. If your date pressures you to go to a private location, end the date.",
  },
];

export default function Safety() {
  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1">
        <div className="mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">Safety Tips</h1>
          <p className="text-muted-foreground">
            Meeting new people is exciting, but you should always be cautious when
            interacting with someone you don't know.
          </p>
        </div>

        <div className="space-y-6">
          {safetyTips.map((tip, index) => (
            <div
              key={index}
              className="p-4 bg-card rounded-xl border border-border animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <tip.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{tip.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tip.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-muted rounded-xl">
          <h3 className="font-bold text-foreground mb-2">LGBTQ+ Travel</h3>
          <p className="text-sm text-muted-foreground">
            Be careful while traveling. Some countries have specific laws that target
            LGBTQ+ people. Review local laws when traveling to a new place and research
            what types of legal protection, if any, are available to you.
          </p>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            This advice is adapted for Canadian and Cuban users in accordance with local regulations.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
