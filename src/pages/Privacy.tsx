import { AuthLayout } from "@/components/AuthLayout";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Privacy() {
  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1">
        <h1 className="text-3xl font-extrabold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-6">Last updated: December 2024</p>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="prose prose-sm max-w-none text-foreground">
            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">1. Who We Are</h2>
              <p className="text-muted-foreground mb-4">
                CubaDate is a dating platform connecting Canadians with Cuban singles.
                We are committed to protecting your privacy and complying with Canadian
                privacy laws (PIPEDA) and applicable Cuban regulations.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">2. Data We Collect</h2>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2">
                <li>Account Data: Email, phone number, date of birth</li>
                <li>Profile Data: Name, gender, interests, photos, bio</li>
                <li>Usage Data: How you interact with our service</li>
                <li>Location Data: Approximate location for matching</li>
                <li>Purchase Data: Transaction details for subscriptions</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">3. How We Use Your Data</h2>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2">
                <li>To create and maintain your profile</li>
                <li>To match you with compatible users</li>
                <li>To process payments and subscriptions</li>
                <li>To keep the platform safe and secure</li>
                <li>To improve our services</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">4. Your Rights</h2>
              <p className="text-muted-foreground mb-4">
                Under Canadian privacy law (PIPEDA), you have the right to:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and data</li>
                <li>Withdraw consent for data processing</li>
                <li>File a complaint with the Privacy Commissioner of Canada</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">5. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your data while your account is active. After account deletion,
                we maintain a safety retention period of 3 months to protect our community.
                Transaction records are kept for 7 years as required by Canadian tax law.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">6. Cross-Border Transfers</h2>
              <p className="text-muted-foreground">
                As we connect users between Canada and Cuba, your data may be transferred
                internationally. We implement appropriate safeguards to protect your data
                during these transfers in compliance with PIPEDA requirements.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">7. Contact Us</h2>
              <p className="text-muted-foreground">
                For privacy inquiries, please contact our Data Protection Officer at
                privacy@cubadate.com or write to us at our Canadian address.
              </p>
            </section>

            <section className="mb-6 p-4 bg-muted rounded-xl">
              <h2 className="text-lg font-bold mb-3">Canadian Users</h2>
              <p className="text-muted-foreground text-sm">
                This privacy policy complies with the Personal Information Protection
                and Electronic Documents Act (PIPEDA). You may contact the Office of
                the Privacy Commissioner of Canada at www.priv.gc.ca for more information.
              </p>
            </section>

            <section className="mb-6 p-4 bg-muted rounded-xl">
              <h2 className="text-lg font-bold mb-3">Cuban Users</h2>
              <p className="text-muted-foreground text-sm">
                We comply with applicable Cuban data protection regulations. Your data
                is processed in accordance with local requirements and international
                standards.
              </p>
            </section>
          </div>
        </ScrollArea>
      </div>
    </AuthLayout>
  );
}
