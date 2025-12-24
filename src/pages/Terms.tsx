import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Shield, FileText, Scale, Ban, CreditCard, Users, Lock, Globe, Gavel, HelpCircle } from "lucide-react";

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
          <h1 className="text-lg font-bold text-foreground">Terms of Service</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 pb-20">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-primary" />
          <p className="text-sm text-muted-foreground">Effective Date: January 1, 2025</p>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Last Updated: January 1, 2025</p>

        <div className="prose prose-sm max-w-none text-foreground">
          {/* Important Notice */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-foreground mb-2">Important Notice</h3>
                <p className="text-sm text-muted-foreground">
                  PLEASE READ THESE TERMS CAREFULLY BEFORE USING OUR SERVICES. BY ACCESSING OR USING CUBADATE, YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE TO ALL OF THESE TERMS, DO NOT USE OUR SERVICES.
                </p>
              </div>
            </div>
          </div>

          {/* California Subscribers Notice */}
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-8">
            <h3 className="font-bold text-foreground mb-2">California Subscribers</h3>
            <p className="text-sm text-muted-foreground">
              You may cancel your subscription, without penalty or obligation, at any time prior to midnight of the third business day following the date you subscribed. If you subscribed using an External Service (e.g., Apple ID, Google Play), you must cancel through your External Service. If you subscribed through our website using a payment provider (e.g., Stripe), you may cancel via your account settings or by contacting support.
            </p>
          </div>

          {/* Table of Contents */}
          <section className="mb-8 bg-card rounded-xl border border-border p-4">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Table of Contents
            </h2>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 text-sm">
              <li>Introduction & Acceptance</li>
              <li>Account Eligibility</li>
              <li>Your Account</li>
              <li>User Responsibilities</li>
              <li>Prohibited Conduct</li>
              <li>Prohibited Content</li>
              <li>Content Ownership & Licenses</li>
              <li>Privacy & Data Protection</li>
              <li>Premium Features & Subscriptions</li>
              <li>Virtual Items & In-App Purchases</li>
              <li>Payment Terms</li>
              <li>Cancellation & Refunds</li>
              <li>Account Termination</li>
              <li>Safety & User Interactions</li>
              <li>Intellectual Property</li>
              <li>Third-Party Services</li>
              <li>Disclaimers</li>
              <li>Limitation of Liability</li>
              <li>Indemnification</li>
              <li>Dispute Resolution & Arbitration</li>
              <li>Governing Law</li>
              <li>Changes to Terms</li>
              <li>General Provisions</li>
              <li>Contact Information</li>
            </ol>
          </section>

          {/* Section 1 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              1. Introduction & Acceptance
            </h2>
            <p className="text-muted-foreground mb-4">
              Welcome to CubaDate! These Terms of Service ("Terms" or "Agreement") govern your access to and use of the CubaDate mobile application, website, and related services (collectively, the "Services") operated by CubaDate Inc. ("CubaDate," "we," "us," or "our").
            </p>
            <p className="text-muted-foreground mb-4">
              By accessing or using our Services, you agree to be bound by these Terms, our Privacy Policy, Cookie Policy, Community Guidelines, and Safety Tips. These documents are incorporated by reference into this Agreement.
            </p>
            <p className="text-muted-foreground mb-4">
              We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on our Services and updating the "Last Updated" date. Your continued use of the Services after any changes constitutes your acceptance of the new Terms.
            </p>
            <p className="text-muted-foreground">
              If you are using our Services on behalf of a company or other legal entity, you represent that you have the authority to bind such entity to these Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              2. Account Eligibility
            </h2>
            <p className="text-muted-foreground mb-4">
              Before you create an account on CubaDate, you must confirm that you meet the following eligibility requirements:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Age Requirement:</strong> You must be at least 18 years old to use our Services. In some jurisdictions, the minimum age may be higher as required by local law.</li>
              <li><strong>Legal Capacity:</strong> You must be legally capable of entering into a binding contract with CubaDate in your jurisdiction.</li>
              <li><strong>Legal Status:</strong> You must not be prohibited by law from using our Services in your jurisdiction.</li>
              <li><strong>Sex Offender Registry:</strong> You must not be required to register as a sex offender with any government entity.</li>
              <li><strong>Previous Termination:</strong> You must not have been previously terminated from our Services, unless you have received our express written permission to create a new account.</li>
              <li><strong>Single Account:</strong> You may only maintain one account on our Services at any time.</li>
              <li><strong>Accurate Information:</strong> You must provide accurate, current, and complete information during registration and maintain the accuracy of such information.</li>
            </ul>
            <p className="text-muted-foreground">
              We reserve the right to request proof of age or identity at any time. Failure to provide such documentation may result in account suspension or termination.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              3. Your Account
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account or any other breach of security.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Account Information:</strong> You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. Inaccurate, false, or incomplete information may result in immediate termination of your account.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Profile Content:</strong> You are solely responsible for the content you include in your profile and for all activity on your account. Your profile should accurately represent who you are and should be appropriate for a dating platform.
            </p>
            <p className="text-muted-foreground">
              <strong>Account Sharing:</strong> Your account is personal and non-transferable. You may not share your account or login credentials with any other person or allow others to access your account.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              4. User Responsibilities
            </h2>
            <p className="text-muted-foreground mb-4">By using our Services, you agree to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Comply with these Terms and all applicable laws, regulations, and ordinances</li>
              <li>Comply with all applicable privacy laws, intellectual property laws, anti-spam laws, and regulatory requirements</li>
              <li>Use the latest version of our mobile application and/or website</li>
              <li>Review and follow our Safety Tips and Community Guidelines</li>
              <li>Take reasonable measures to protect the security of your login information</li>
              <li>Treat other users with respect and dignity</li>
              <li>Report any violations of these Terms or any suspicious or illegal activity</li>
              <li>Not interfere with or disrupt the Services or servers or networks connected to the Services</li>
              <li>Not attempt to access any other user's account without permission</li>
              <li>Not use automated scripts, bots, or other automated methods to access the Services</li>
              <li>Promptly update your information if it changes</li>
              <li>Be solely responsible for your interactions with other users</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Ban className="w-5 h-5 text-primary" />
              5. Prohibited Conduct
            </h2>
            <p className="text-muted-foreground mb-4">You agree that you will NOT:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Misrepresent your identity, age, current or previous positions, qualifications, or affiliations with a person or entity</li>
              <li>Use the Services in a way that damages the Services or prevents their use by other users</li>
              <li>Use our Services for any harmful, illegal, or nefarious purpose</li>
              <li>Harass, bully, stalk, intimidate, assault, defame, harm, or otherwise mistreat any person</li>
              <li>Post or share any Prohibited Content (as defined in Section 6)</li>
              <li>Solicit money, donations, or other items of value from any user</li>
              <li>Use another user's account without their explicit permission</li>
              <li>Use our Services in relation to fraud, pyramid schemes, or similar practices</li>
              <li>Disclose private or confidential information of another person without their consent</li>
              <li>Copy, modify, transmit, create derivative works from, or reverse engineer any portion of the Services</li>
              <li>Express or imply that any statements you make are endorsed by CubaDate</li>
              <li>Use any automated system to access the Services (including bots, spiders, or scrapers)</li>
              <li>Collect usernames and/or email addresses of users for sending unsolicited communications</li>
              <li>Create, solicit, or distribute unsolicited promotional or advertising materials</li>
              <li>Circumvent, disable, or otherwise interfere with security-related features of the Services</li>
              <li>Use the Services to promote or facilitate prostitution or escort services</li>
              <li>Use the Services for any commercial purpose without our prior written consent</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              6. Prohibited Content
            </h2>
            <p className="text-muted-foreground mb-4">
              CubaDate prohibits uploading, posting, sharing, or transmitting any content that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Is offensive, harassing, abusive, or causes psychological distress to others</li>
              <li>Contains nudity, sexually explicit material, or pornographic content</li>
              <li>Depicts violence, gore, or cruelty to humans or animals</li>
              <li>Is abusive, threatening, racist, bigoted, or discriminatory based on race, ethnicity, national origin, religion, gender, sexual orientation, disability, or any other protected characteristic</li>
              <li>Encourages, promotes, or glorifies illegal activity or violence</li>
              <li>Is defamatory, libelous, or knowingly false</li>
              <li>Infringes upon any third party's intellectual property rights, including copyrights, trademarks, or trade secrets</li>
              <li>Contains spam, advertisements, or commercial solicitations</li>
              <li>Contains viruses, malware, worms, Trojan horses, or other harmful code</li>
              <li>Promotes weapons, drugs, tobacco, or alcohol to minors</li>
              <li>Involves the exploitation or endangerment of minors</li>
              <li>Contains personal contact information of others without their consent</li>
              <li>Impersonates any person or entity or misrepresents your affiliation with a person or entity</li>
              <li>Violates any applicable law or regulation</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We reserve the right to remove any content that violates these Terms or that we determine, in our sole discretion, is inappropriate or harmful. Repeated violations may result in permanent account termination.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              7. Content Ownership & Licenses
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>Your Content:</strong> You retain ownership of all content you submit, post, or display on or through our Services ("Your Content"). By submitting Your Content, you grant CubaDate a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to use, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, and display Your Content in connection with operating and providing our Services.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Representations:</strong> You represent and warrant that: (i) you own Your Content or have the right to grant the license above; (ii) Your Content does not violate the rights of any third party; and (iii) Your Content complies with these Terms and all applicable laws.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Member Content:</strong> Other users' content ("Member Content") belongs to the user who posted it. You may not use, copy, reproduce, distribute, or create derivative works from Member Content without the express permission of the content owner.
            </p>
            <p className="text-muted-foreground">
              <strong>Our Content:</strong> All content provided by CubaDate, including but not limited to text, graphics, logos, icons, images, audio clips, video clips, data compilations, and software, is the property of CubaDate or its licensors and is protected by intellectual property laws.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              8. Privacy & Data Protection
            </h2>
            <p className="text-muted-foreground mb-4">
              For detailed information about how we collect, use, share, and protect your personal data, please review our Privacy Policy. By using our Services, you acknowledge that you have read and understood our Privacy Policy and consent to our data practices as described therein.
            </p>
            <p className="text-muted-foreground mb-4">
              We are committed to protecting your privacy and complying with applicable data protection laws, including the General Data Protection Regulation (GDPR) for users in the European Economic Area and the California Consumer Privacy Act (CCPA) for California residents.
            </p>
            <p className="text-muted-foreground">
              You have certain rights regarding your personal data, including the right to access, correct, delete, and port your data. For more information about your rights and how to exercise them, please see our Privacy Policy or contact us at the address provided below.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              9. Premium Features & Subscriptions
            </h2>
            <p className="text-muted-foreground mb-4">
              CubaDate offers various premium features and subscription plans that provide enhanced functionality. Current subscription options include:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>CubaDate Plus:</strong> Basic premium features including unlimited likes, rewinds, and 1 boost per month</li>
              <li><strong>CubaDate Gold:</strong> Includes all Plus features plus see who likes you, Top Picks, and weekly Super Likes</li>
              <li><strong>CubaDate Platinum:</strong> Includes all Gold features plus priority likes, message before matching, and profile controls</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              <strong>Subscription Terms:</strong> When you purchase a subscription, you agree to the specific terms presented at the time of purchase. Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal date.
            </p>
            <p className="text-muted-foreground">
              <strong>Price Changes:</strong> We reserve the right to change our subscription prices. Any price changes will apply to billing periods starting after the change becomes effective. We will provide you with advance notice of any price increases.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              10. Virtual Items & In-App Purchases
            </h2>
            <p className="text-muted-foreground mb-4">
              CubaDate may offer virtual items for purchase, including but not limited to Super Likes, Boosts, and other premium features ("Virtual Items"). Virtual Items represent a limited license right governed by this Agreement.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>License:</strong> Virtual Items are not your property. You receive a limited, non-transferable, revocable license to use Virtual Items within our Services. Virtual Items have no monetary value and cannot be exchanged for cash or any other item of value.
            </p>
            <p className="text-muted-foreground mb-4 font-semibold bg-destructive/10 p-3 rounded-lg">
              ALL PURCHASES AND REDEMPTIONS OF VIRTUAL ITEMS MADE THROUGH OUR SERVICES ARE FINAL AND NON-REFUNDABLE, EXCEPT AS REQUIRED BY APPLICABLE LAW.
            </p>
            <p className="text-muted-foreground">
              <strong>Expiration:</strong> Virtual Items may have expiration dates or usage limits. Unused Virtual Items will expire according to the terms disclosed at the time of purchase. Upon account termination, all Virtual Items will be forfeited.
            </p>
          </section>

          {/* Section 11 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              11. Payment Terms
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>Payment Methods:</strong> We accept payment through various methods, including credit cards, debit cards, and mobile payment platforms (Apple App Store, Google Play Store). By providing payment information, you represent that you are authorized to use the designated payment method.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Authorization:</strong> When you make a purchase, you authorize us (or our third-party payment processor) to charge your payment method for the total amount of your purchase, including any applicable taxes and fees.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>External Services:</strong> If you purchase through an app store (Apple App Store, Google Play), the purchase will be processed according to that platform's terms and conditions. Please review the applicable app store's payment terms before making a purchase.
            </p>
            <p className="text-muted-foreground">
              <strong>Currency:</strong> All prices are displayed in the currency applicable to your location. Currency conversion rates are determined by your payment provider.
            </p>
          </section>

          {/* Section 12 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              12. Cancellation & Refunds
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>Cancellation:</strong> You may cancel your subscription at any time through your account settings or through the app store where you made the purchase. Upon cancellation, you will continue to have access to your subscription benefits until the end of your current billing period.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Refund Policy:</strong> Generally, purchases are non-refundable. However, refunds may be available in the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>As required by applicable law</li>
              <li>For California residents within the cancellation period described above</li>
              <li>Where we determine, in our sole discretion, that a refund is warranted</li>
            </ul>
            <p className="text-muted-foreground">
              <strong>External Service Purchases:</strong> If you made your purchase through an external service (App Store, Google Play), you must request refunds through that service according to their policies.
            </p>
          </section>

          {/* Section 13 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Ban className="w-5 h-5 text-primary" />
              13. Account Termination
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>Termination by You:</strong> You can delete your account at any time by logging into the app, going to "Settings," clicking "Delete Account," and following the instructions. Deleting your account will remove your profile and data from our active systems, subject to our data retention policies.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Termination by CubaDate:</strong> We reserve the right to investigate and, if appropriate, suspend or terminate your account without refund if we believe you have violated these Terms. We may also terminate accounts that are inactive for an extended period or for any other reason at our discretion.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Effect of Termination:</strong> Upon termination:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Your license to use the Services immediately terminates</li>
              <li>You will lose access to all premium features and Virtual Items</li>
              <li>We may delete your account data, subject to our legal obligations</li>
              <li>You will not receive a refund for any unused subscription period or Virtual Items</li>
            </ul>
          </section>

          {/* Section 14 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              14. Safety & User Interactions
            </h2>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
              <p className="text-sm text-foreground uppercase font-semibold">
                YOU UNDERSTAND AND AGREE THAT CUBADATE DOES NOT CONDUCT CRIMINAL BACKGROUND CHECKS OR IDENTITY VERIFICATION ON ITS USERS. CUBADATE MAKES NO REPRESENTATIONS OR WARRANTIES AS TO THE CONDUCT, IDENTITY, HEALTH, PHYSICAL CONDITION, INTENTIONS, LEGITIMACY, OR VERACITY OF USERS.
              </p>
            </div>
            <p className="text-muted-foreground mb-4">
              <strong>User Responsibility:</strong> You are solely responsible for your interactions with other users. Always use your best judgment and take appropriate safety precautions when communicating with or meeting new people, whether online or in person.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Safety Recommendations:</strong> We strongly recommend:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Never share personal financial information with other users</li>
              <li>Meet in public places for initial in-person meetings</li>
              <li>Tell a friend or family member about your plans</li>
              <li>Report any suspicious behavior to CubaDate and local authorities</li>
              <li>Review our Safety Tips regularly</li>
            </ul>
          </section>

          {/* Section 15 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              15. Intellectual Property
            </h2>
            <p className="text-muted-foreground mb-4">
              The CubaDate name, logo, and all related names, logos, product and service names, designs, and slogans are trademarks of CubaDate Inc. or its affiliates. You may not use such marks without our prior written permission.
            </p>
            <p className="text-muted-foreground mb-4">
              All content, features, and functionality of our Services, including but not limited to information, software, text, displays, images, video, and audio, are owned by CubaDate, its licensors, or other providers of such material and are protected by copyright, trademark, patent, and other intellectual property laws.
            </p>
            <p className="text-muted-foreground">
              <strong>DMCA:</strong> If you believe that any content on our Services infringes your copyright, please contact us with a DMCA notice. We will respond to valid notices in accordance with the Digital Millennium Copyright Act.
            </p>
          </section>

          {/* Section 16 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              16. Third-Party Services
            </h2>
            <p className="text-muted-foreground mb-4">
              Our Services may contain links to third-party websites, advertisers, services, or resources that are not owned or controlled by CubaDate. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party sites or services.
            </p>
            <p className="text-muted-foreground mb-4">
              We may use third-party service providers to help operate our Services, process payments, send communications, or analyze data. These providers are subject to their own terms and privacy policies.
            </p>
            <p className="text-muted-foreground">
              Your use of third-party services is at your own risk and subject to the terms and conditions of those third parties.
            </p>
          </section>

          {/* Section 17 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              17. Disclaimers
            </h2>
            <div className="bg-muted/50 p-4 rounded-xl">
              <p className="text-sm text-muted-foreground uppercase mb-4">
                CUBADATE PROVIDES OUR SERVICES ON AN "AS IS" AND "AS AVAILABLE" BASIS AND TO THE EXTENT PERMITTED BY APPLICABLE LAW, GRANTS NO WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY OR OTHERWISE WITH RESPECT TO OUR SERVICES, INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT.
              </p>
              <p className="text-sm text-muted-foreground uppercase mb-4">
                WE DO NOT WARRANT THAT (A) THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE; (B) ANY DEFECTS OR ERRORS WILL BE CORRECTED; (C) THE SERVICES OR ANY CONTENT ARE FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS; OR (D) THE RESULTS OF USING THE SERVICES WILL MEET YOUR REQUIREMENTS.
              </p>
              <p className="text-sm text-muted-foreground uppercase">
                WE DO NOT REPRESENT OR WARRANT THAT ANY CONTENT OR MATERIALS ON OUR SERVICES ARE ACCURATE, COMPLETE, RELIABLE, CURRENT, OR ERROR-FREE.
              </p>
            </div>
          </section>

          {/* Section 18 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              18. Limitation of Liability
            </h2>
            <div className="bg-muted/50 p-4 rounded-xl">
              <p className="text-sm text-muted-foreground uppercase mb-4">
                TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL CUBADATE, ITS AFFILIATES, EMPLOYEES, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, PUNITIVE, FIXED, OR ENHANCED DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 uppercase text-sm mb-4">
                <li>YOUR ACCESS TO OR USE OF (OR INABILITY TO ACCESS OR USE) THE SERVICES</li>
                <li>THE CONDUCT OR CONTENT OF ANY USERS OR THIRD PARTIES ON, THROUGH, OR FOLLOWING USE OF THE SERVICES</li>
                <li>ANY CONTENT OBTAINED FROM THE SERVICES</li>
                <li>UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR CONTENT</li>
              </ul>
              <p className="text-sm text-muted-foreground uppercase">
                IN NO EVENT SHALL THE AGGREGATE LIABILITY OF CUBADATE EXCEED THE AMOUNT YOU PAID, IF ANY, IN THE LAST 12 MONTHS FOR THE SERVICES GIVING RISE TO THE CLAIM, OR $100 USD, WHICHEVER IS GREATER.
              </p>
            </div>
          </section>

          {/* Section 19 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              19. Indemnification
            </h2>
            <p className="text-muted-foreground mb-4">
              You agree to indemnify, defend, and hold harmless CubaDate, its affiliates, and their respective officers, directors, employees, agents, licensors, and service providers from and against any and all claims, demands, damages, obligations, losses, liabilities, costs, or expenses (including reasonable attorneys' fees) arising from:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Your access to or use of the Services</li>
              <li>Your Content or any content you post, upload, or transmit through the Services</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party, including other users</li>
              <li>Your violation of any applicable law, rule, or regulation</li>
            </ul>
          </section>

          {/* Section 20 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Gavel className="w-5 h-5 text-primary" />
              20. Dispute Resolution & Arbitration
            </h2>
            <p className="text-muted-foreground mb-4 font-semibold">
              PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Informal Resolution:</strong> Before filing a claim, you agree to try to resolve the dispute informally by contacting us. We'll try to resolve the dispute informally by contacting you via email within 30 days.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Binding Arbitration:</strong> If we cannot resolve a dispute informally, you and CubaDate agree to resolve any dispute arising out of or relating to these Terms or the Services through final and binding arbitration. The arbitration will be administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Class Action Waiver:</strong> YOU AND CUBADATE AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE ACTION.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Exceptions:</strong> Either party may bring a claim in small claims court if eligible, or seek injunctive relief in any court of competent jurisdiction for intellectual property or unauthorized access violations.
            </p>
            <p className="text-muted-foreground">
              <strong>Opt-Out:</strong> You can opt out of this arbitration provision by sending a written notice within 30 days of first accepting these Terms to: CubaDate Inc., Legal Department, [Address], or by email to legal@cubadate.com.
            </p>
          </section>

          {/* Section 21 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              21. Governing Law
            </h2>
            <p className="text-muted-foreground mb-4">
              These Terms and any dispute arising out of or related to these Terms or the Services shall be governed by and construed in accordance with the laws of the State of Florida, United States, without regard to its conflict of law principles.
            </p>
            <p className="text-muted-foreground mb-4">
              For any disputes not subject to arbitration, you and CubaDate agree to submit to the personal and exclusive jurisdiction of the state and federal courts located in Miami-Dade County, Florida.
            </p>
            <p className="text-muted-foreground">
              <strong>International Users:</strong> If you access the Services from outside the United States, you do so at your own risk and are responsible for compliance with local laws.
            </p>
          </section>

          {/* Section 22 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              22. Changes to Terms
            </h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to modify these Terms at any time. When we make material changes, we will:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Update the "Last Updated" date at the top of these Terms</li>
              <li>Provide notice through the Services or by email</li>
              <li>Give you the opportunity to review the changes before they take effect</li>
            </ul>
            <p className="text-muted-foreground">
              Your continued use of the Services after any changes indicates your acceptance of the new Terms. If you do not agree to the new Terms, you must stop using the Services and delete your account.
            </p>
          </section>

          {/* Section 23 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              23. General Provisions
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy and any other legal notices we provide, constitute the entire agreement between you and CubaDate regarding the Services.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Severability:</strong> If any provision of these Terms is held to be invalid or unenforceable, that provision will be enforced to the maximum extent permissible, and the other provisions will remain in full force and effect.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Waiver:</strong> No waiver of any term of these Terms shall be deemed a further or continuing waiver of such term or any other term.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Assignment:</strong> You may not assign or transfer these Terms or your rights hereunder without our prior written consent. We may assign or transfer these Terms without restriction.
            </p>
            <p className="text-muted-foreground">
              <strong>Force Majeure:</strong> We will not be liable for any failure or delay in performing our obligations where such failure or delay results from circumstances beyond our reasonable control.
            </p>
          </section>

          {/* Section 24 */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              24. Contact Information
            </h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions, concerns, or complaints about these Terms or our Services, please contact us:
            </p>
            <div className="bg-card p-4 rounded-xl border border-border">
              <p className="text-foreground font-semibold mb-2">CubaDate Inc.</p>
              <p className="text-muted-foreground text-sm mb-1">Legal Department</p>
              <p className="text-muted-foreground text-sm mb-1">1234 Brickell Avenue, Suite 500</p>
              <p className="text-muted-foreground text-sm mb-1">Miami, FL 33131</p>
              <p className="text-muted-foreground text-sm mb-1">United States</p>
              <p className="text-muted-foreground text-sm mt-3">Email: legal@cubadate.com</p>
              <p className="text-muted-foreground text-sm">Support: support@cubadate.com</p>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="mt-8 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              By using CubaDate, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
