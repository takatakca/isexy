import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-10">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Terms of Use</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 pb-20">
        <p className="text-sm text-muted-foreground mb-6">Effective on June 1, 2024</p>

        <div className="prose prose-sm max-w-none text-foreground">
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">Summary</h2>
            <p className="text-muted-foreground mb-4">
              California subscribers: You may cancel your subscription, without penalty or obligation, at any time prior to midnight of the third business day following the date you subscribed. If you subscribed using an External Service (e.g., Apple ID, Google Play), you must cancel through your External Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground mb-4">
              By accessing or using CubaDate's Services, you agree to be bound by this Terms of Use Agreement (the "Terms" or "Agreement"), including our Privacy Policy, Cookie Policy, Community Guidelines, and Safety Tips, so it is important that you read this Agreement and these policies and procedures carefully before you create an account.
            </p>
            <p className="text-muted-foreground">
              We may update these Terms from time to time, so check this page regularly for updates.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">2. Account Eligibility</h2>
            <p className="text-muted-foreground mb-4">
              Before you create an account on CubaDate, make sure you are eligible to use our Services. You must be:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>An individual at least 18 years old</li>
              <li>Legally qualified to enter a binding contract with CubaDate</li>
              <li>Not prohibited by law from using our Services</li>
              <li>Not required to register as a sex offender</li>
              <li>Not have more than one account on our Services</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">3. Your Responsibilities</h2>
            <p className="text-muted-foreground mb-4">You agree to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Comply with these Terms, and check this page from time to time to ensure you are aware of any changes</li>
              <li>Comply with all applicable laws, including privacy laws, intellectual property laws, anti-spam laws, and regulatory requirements</li>
              <li>Use the latest version of the Website and/or App</li>
              <li>Review the Safety Tips</li>
              <li>Review and comply with the Community Guidelines</li>
              <li>Take reasonable measures to protect the security of your login information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">4. Prohibited Actions</h2>
            <p className="text-muted-foreground mb-4">You agree that you will not:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Misrepresent your identity, age, or affiliations</li>
              <li>Use the Services in a way that damages the Services or prevents their use by other users</li>
              <li>Use our Services for any harmful, illegal, or nefarious purpose</li>
              <li>Harass, bully, stalk, intimidate, assault, defame, harm or otherwise abuse others</li>
              <li>Post or share Prohibited Content</li>
              <li>Solicit money or other items of value from another user</li>
              <li>Use another user's account</li>
              <li>Use our Services in relation to fraud or pyramid schemes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">5. Prohibited Content</h2>
            <p className="text-muted-foreground mb-4">
              CubaDate prohibits uploading or sharing content that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Is offensive, harassing, or causes psychological distress</li>
              <li>Is obscene, pornographic, violent or contains nudity</li>
              <li>Is abusive, threatening, discriminatory</li>
              <li>Encourages illegal activity</li>
              <li>Is defamatory, libelous, or untrue</li>
              <li>Relates to commercial activities (sales, promotions, advertising)</li>
              <li>Contains viruses or malicious code</li>
              <li>Infringes upon third party rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">6. Content</h2>
            <p className="text-muted-foreground mb-4">
              While using our Services, you will have access to: (i) content that you upload or provide ("Your Content"); (ii) content that other users upload ("Member Content"); and (iii) content that CubaDate provides ("Our Content").
            </p>
            <p className="text-muted-foreground">
              You are solely responsible and liable for Your Content. The content included on your individual profile should be relevant to the intended use of our Services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">7. Privacy</h2>
            <p className="text-muted-foreground">
              For information about how CubaDate and its affiliates collect, use, and share your personal data, please read our Privacy Policy. By using our Services, you agree that we may use your personal data in accordance with our Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">8. Purchases and Subscriptions</h2>
            <p className="text-muted-foreground mb-4">
              CubaDate may offer products and services for purchase. If you purchase a subscription, it will automatically renew until you cancel, in accordance with the terms disclosed to you at the time of purchase.
            </p>
            <p className="text-muted-foreground">
              If you cancel your subscription, you will continue to have access to your subscription benefits until the end of your subscription period, at which point it will expire.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">9. Virtual Items</h2>
            <p className="text-muted-foreground mb-4">
              From time to time, you may have the opportunity to purchase Virtual Items (such as Super Likes, Boosts, or Gifts). Virtual Items represent a limited license right governed by this Agreement.
            </p>
            <p className="text-muted-foreground font-semibold">
              ALL PURCHASES AND REDEMPTIONS OF VIRTUAL ITEMS MADE THROUGH OUR SERVICES ARE FINAL AND NON-REFUNDABLE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">10. Account Termination</h2>
            <p className="text-muted-foreground mb-4">
              You can delete your account at any time by logging into the App, going to "Settings", clicking "Delete Account", and following the instructions.
            </p>
            <p className="text-muted-foreground">
              CubaDate reserves the right to investigate and, if appropriate, suspend or terminate your account without a refund if CubaDate believes that you have violated these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">11. Safety</h2>
            <p className="text-muted-foreground mb-4 uppercase text-xs">
              YOU UNDERSTAND THAT CUBADATE DOES NOT CONDUCT CRIMINAL BACKGROUND OR IDENTITY VERIFICATION CHECKS ON ITS USERS. CUBADATE MAKES NO REPRESENTATIONS OR WARRANTIES AS TO THE CONDUCT, IDENTITY, HEALTH, INTENTIONS, LEGITIMACY, OR VERACITY OF USERS.
            </p>
            <p className="text-muted-foreground">
              You are solely responsible for your interactions with other users. Always use your best judgment and take appropriate safety precautions when communicating with or meeting new people.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">12. Disclaimer</h2>
            <p className="text-muted-foreground uppercase text-xs">
              CUBADATE PROVIDES OUR SERVICES ON AN "AS IS" AND "AS AVAILABLE" BASIS AND TO THE EXTENT PERMITTED BY APPLICABLE LAW, GRANTS NO WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY OR OTHERWISE WITH RESPECT TO OUR SERVICES.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">13. Limitation of Liability</h2>
            <p className="text-muted-foreground uppercase text-xs">
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL CUBADATE, ITS AFFILIATES, EMPLOYEES, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, PUNITIVE, OR ENHANCED DAMAGES.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">14. Contact Information</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms, please contact us through the app's Help & Support section.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
