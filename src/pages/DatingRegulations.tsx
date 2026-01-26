import { AuthLayout } from "@/components/AuthLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Scale, MapPin, Shield, AlertTriangle, Users, Heart, FileText } from "lucide-react";

export default function DatingRegulations() {
  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Dating Regulations</h1>
            <p className="text-sm text-muted-foreground">Canada & Cuba Laws</p>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="prose prose-sm max-w-none text-foreground pr-4 space-y-6">
            
            {/* Introduction */}
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
              <p className="text-muted-foreground text-sm">
                CubaDate operates under both Canadian and Cuban laws. As a user, you are responsible for 
                understanding and complying with the laws applicable to you based on your location. This 
                page provides an overview of relevant regulations in both jurisdictions.
              </p>
            </div>

            <Separator className="my-6" />

            {/* Canadian Laws */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-red-500" />
                <h2 className="text-xl font-bold">🇨🇦 Canadian Dating Laws & Regulations</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Age of Consent
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    The age of consent in Canada is <strong>16 years old</strong>. However, CubaDate requires all 
                    users to be at least <strong>18 years old</strong> to use our services. Sexual activity with 
                    persons under 18 may be illegal if there is a relationship of trust, authority, or dependency, 
                    or if there is exploitation.
                  </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Criminal Code Provisions
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
                    <li><strong>Section 162.1:</strong> Publication of intimate images without consent is a criminal offense punishable by up to 5 years imprisonment.</li>
                    <li><strong>Section 264:</strong> Criminal harassment (stalking) is prohibited and includes repeated unwanted communication.</li>
                    <li><strong>Section 264.1:</strong> Uttering threats is a criminal offense.</li>
                    <li><strong>Section 372:</strong> False messages and harassing communications are prohibited.</li>
                    <li><strong>Section 380:</strong> Fraud (including romance scams) is punishable by up to 14 years imprisonment.</li>
                  </ul>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Privacy Laws (PIPEDA)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Under Canada's Personal Information Protection and Electronic Documents Act (PIPEDA), 
                    organizations must obtain meaningful consent for the collection, use, and disclosure of 
                    personal information. Users have the right to access their personal data and request corrections.
                  </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-primary" />
                    Anti-Discrimination Laws
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    The Canadian Human Rights Act prohibits discrimination based on race, national or ethnic 
                    origin, colour, religion, age, sex, sexual orientation, gender identity, marital status, 
                    family status, genetic characteristics, or disability. While dating preferences are personal, 
                    users should treat all other users with dignity and respect.
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Quebec-Specific Laws
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    As CubaDate is headquartered in Montreal, Quebec, additional provincial laws apply. The 
                    Quebec Charter of Human Rights and Freedoms provides enhanced protections. Consumer Protection 
                    Act provisions apply to subscription services, including the right to cancel within 10 days 
                    of receiving a contract.
                  </p>
                </div>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Cuban Laws */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-bold">🇨🇺 Cuban Dating Laws & Regulations</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Age of Consent & Marriage
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    The age of consent in Cuba is <strong>16 years old</strong>. The legal minimum age for 
                    marriage is 18 years. The 2022 Cuban Family Code introduced significant reforms recognizing 
                    equal rights regardless of sexual orientation or gender identity.
                  </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Cuban Penal Code
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
                    <li><strong>Sexual Assault:</strong> Sexual offenses are prosecuted under the Cuban Penal Code with significant penalties.</li>
                    <li><strong>Harassment:</strong> Stalking and harassment behaviors are criminally punishable.</li>
                    <li><strong>Human Trafficking:</strong> Cuba has strong laws against human trafficking with severe penalties.</li>
                    <li><strong>Fraud:</strong> Scams and fraud, including romance scams, are criminal offenses.</li>
                  </ul>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-primary" />
                    2022 Family Code
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Cuba's 2022 Family Code represents progressive legislation that:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5 mt-2">
                    <li>Legalizes same-sex marriage</li>
                    <li>Recognizes diverse family structures</li>
                    <li>Provides equal rights for LGBTQ+ couples</li>
                    <li>Allows same-sex couples to adopt children</li>
                    <li>Prohibits gender-based violence</li>
                  </ul>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Data Protection
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Cuba's Constitution guarantees the right to privacy. While comprehensive data protection 
                    legislation is still developing, CubaDate applies international standards (GDPR-like 
                    protections) to all users regardless of location.
                  </p>
                </div>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Cross-Border Considerations */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" />
                Cross-Border Relationship Considerations
              </h2>

              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2">Immigration & Sponsorship</h3>
                  <p className="text-sm text-muted-foreground">
                    Canadians may sponsor a spouse, common-law partner, or conjugal partner for permanent 
                    residence in Canada. Requirements include proof of genuine relationship and meeting 
                    minimum income thresholds. Processing times vary, and legal consultation is recommended.
                  </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2">Travel Requirements</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    <li>Canadians can travel to Cuba for tourism without a visa (tourist card required)</li>
                    <li>Cubans require a visa to visit Canada</li>
                    <li>Both countries require valid passports</li>
                    <li>Travel health insurance is mandatory for travel to Cuba</li>
                  </ul>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Important Warning
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Be cautious of romance scams. Never send money to someone you haven't met in person. 
                    CubaDate actively monitors for fraudulent activity, but users should remain vigilant. 
                    Report suspicious behavior immediately through our reporting system.
                  </p>
                </div>
              </div>
            </section>

            <Separator className="my-6" />

            {/* User Responsibilities */}
            <section>
              <h2 className="text-xl font-bold mb-4">Your Responsibilities</h2>
              <div className="bg-muted rounded-xl p-4">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>✓ Be honest about your identity and intentions</li>
                  <li>✓ Respect the boundaries and consent of other users</li>
                  <li>✓ Report any illegal or suspicious activity</li>
                  <li>✓ Comply with all applicable laws in your jurisdiction</li>
                  <li>✓ Seek legal advice for immigration or sponsorship matters</li>
                  <li>✓ Protect your personal information and privacy</li>
                  <li>✗ Never send money to users you haven't met</li>
                  <li>✗ Never share intimate images without explicit consent</li>
                  <li>✗ Never engage in any form of harassment or discrimination</li>
                </ul>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Contact */}
            <section className="pb-8">
              <h2 className="text-xl font-bold mb-4">Legal Questions?</h2>
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                <p className="text-muted-foreground text-sm mb-3">
                  For legal questions regarding CubaDate's policies or cross-border dating considerations:
                </p>
                <p className="text-foreground font-medium">Email: legal@cubadate.com</p>
                <p className="text-muted-foreground text-sm">Canada: +1 450 999 4999</p>
                <p className="text-muted-foreground text-sm">Cuba WhatsApp: +53 5307 1185</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Note: This page provides general information only and does not constitute legal advice. 
                  Consult a licensed attorney for specific legal questions.
                </p>
              </div>
            </section>
          </div>
        </ScrollArea>
      </div>
    </AuthLayout>
  );
}
