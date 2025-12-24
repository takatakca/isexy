import { AuthLayout } from "@/components/AuthLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function Privacy() {
  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1">
        <h1 className="text-3xl font-extrabold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-6">Effective Date: December 24, 2024</p>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="prose prose-sm max-w-none text-foreground pr-4">
            
            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground mb-4">
                Welcome to CubaDate. We respect your privacy and are committed to protecting your personal data. 
                This privacy policy will inform you how we look after your personal data when you visit our website 
                or use our mobile application and tell you about your privacy rights and how the law protects you.
              </p>
              <p className="text-muted-foreground mb-4">
                This privacy policy is provided in a layered format so you can click through to the specific areas 
                set out below. Alternatively, you can download a PDF version of the policy here.
              </p>
            </section>

            <Separator className="my-6" />

            {/* Who We Are */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">2. Who We Are</h2>
              <p className="text-muted-foreground mb-4">
                CubaDate is operated by CubaDate Inc., a company registered in Canada. We are the data controller 
                responsible for your personal data. If you have any questions about this privacy policy, please 
                contact our Data Protection Officer at:
              </p>
              <div className="bg-muted p-4 rounded-xl mb-4">
                <p className="text-foreground font-medium">Data Protection Officer</p>
                <p className="text-muted-foreground">Email: privacy@cubadate.com</p>
                <p className="text-muted-foreground">Address: Toronto, Ontario, Canada</p>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Data We Collect */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">3. The Data We Collect About You</h2>
              <p className="text-muted-foreground mb-4">
                Personal data means any information about an individual from which that person can be identified. 
                We may collect, use, store and transfer different kinds of personal data about you:
              </p>
              
              <h3 className="text-lg font-semibold mb-3 mt-6">3.1 Information You Provide</h3>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2 mb-4">
                <li><strong>Identity Data:</strong> First name, last name, username, date of birth, gender</li>
                <li><strong>Contact Data:</strong> Email address, telephone number</li>
                <li><strong>Profile Data:</strong> Photos, bio, interests, preferences, relationship goals</li>
                <li><strong>Communication Data:</strong> Messages sent through the platform</li>
                <li><strong>Financial Data:</strong> Payment card details, billing address (processed by Stripe)</li>
                <li><strong>Survey Data:</strong> Feedback, survey responses, reviews</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3 mt-6">3.2 Information We Collect Automatically</h3>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2 mb-4">
                <li><strong>Technical Data:</strong> IP address, device type, browser type, operating system, time zone</li>
                <li><strong>Usage Data:</strong> How you use our app, features accessed, time spent on pages</li>
                <li><strong>Location Data:</strong> Approximate location based on IP address or precise location if you grant permission</li>
                <li><strong>Device Data:</strong> Device identifiers, advertising IDs, hardware model</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3 mt-6">3.3 Special Categories of Personal Data</h3>
              <p className="text-muted-foreground mb-4">
                We may collect special categories of data including information about your sexual orientation 
                (if you choose to provide it). This data is only processed with your explicit consent.
              </p>
            </section>

            <Separator className="my-6" />

            {/* How We Use Your Data */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">4. How We Use Your Personal Data</h2>
              <p className="text-muted-foreground mb-4">
                We will only use your personal data when the law allows us to. Most commonly, we will use your 
                personal data in the following circumstances:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-3 mb-4">
                <li><strong>To provide our services:</strong> Create your account, display your profile, facilitate matches and communications</li>
                <li><strong>To improve our services:</strong> Analyze usage patterns, test new features, improve matching algorithms</li>
                <li><strong>To communicate with you:</strong> Send service updates, security alerts, support messages</li>
                <li><strong>To process payments:</strong> Handle subscription payments and transaction records</li>
                <li><strong>To ensure safety:</strong> Detect and prevent fraud, abuse, spam, and other harmful activities</li>
                <li><strong>To comply with legal obligations:</strong> Respond to legal requests, enforce terms of service</li>
                <li><strong>For marketing:</strong> Send promotional content with your consent (you can opt-out anytime)</li>
              </ul>
            </section>

            <Separator className="my-6" />

            {/* Legal Basis for Processing (GDPR) */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">5. Legal Basis for Processing (GDPR)</h2>
              <p className="text-muted-foreground mb-4">
                Under GDPR and other applicable laws, we rely on the following legal bases to process your personal data:
              </p>
              
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Contractual Necessity</h4>
                  <p className="text-muted-foreground text-sm">
                    Processing necessary to perform our contract with you (e.g., providing the dating service, processing payments).
                  </p>
                </div>
                
                <div className="bg-muted p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Legitimate Interests</h4>
                  <p className="text-muted-foreground text-sm">
                    Processing for our legitimate interests (e.g., improving services, preventing fraud, ensuring security), 
                    provided these interests are not overridden by your rights.
                  </p>
                </div>
                
                <div className="bg-muted p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Consent</h4>
                  <p className="text-muted-foreground text-sm">
                    Where you have given us explicit consent to process your data (e.g., marketing communications, 
                    location tracking, special category data).
                  </p>
                </div>
                
                <div className="bg-muted p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Legal Obligation</h4>
                  <p className="text-muted-foreground text-sm">
                    Processing necessary to comply with legal obligations (e.g., tax records, responding to court orders).
                  </p>
                </div>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Data Sharing */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">6. How We Share Your Personal Data</h2>
              <p className="text-muted-foreground mb-4">
                We may share your personal data with the following parties:
              </p>
              
              <h3 className="text-lg font-semibold mb-3 mt-6">6.1 Other Users</h3>
              <p className="text-muted-foreground mb-4">
                Your profile information, photos, and certain activity are visible to other users of the platform. 
                You control what information is displayed through your privacy settings.
              </p>

              <h3 className="text-lg font-semibold mb-3 mt-6">6.2 Service Providers</h3>
              <p className="text-muted-foreground mb-4">
                We work with third-party service providers who help us operate our platform:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2 mb-4">
                <li>Cloud hosting providers (data storage and processing)</li>
                <li>Payment processors (Stripe for payment handling)</li>
                <li>Analytics providers (to improve our services)</li>
                <li>Customer support tools</li>
                <li>Email and push notification services</li>
                <li>Identity verification services</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3 mt-6">6.3 Affiliates</h3>
              <p className="text-muted-foreground mb-4">
                We may share data with our corporate affiliates for data processing, customer care, and security purposes.
              </p>

              <h3 className="text-lg font-semibold mb-3 mt-6">6.4 Legal and Safety</h3>
              <p className="text-muted-foreground mb-4">
                We may disclose your data to comply with legal obligations, respond to government requests, 
                protect our rights and safety, or prevent fraud and abuse.
              </p>

              <h3 className="text-lg font-semibold mb-3 mt-6">6.5 Corporate Transactions</h3>
              <p className="text-muted-foreground mb-4">
                If we are involved in a merger, acquisition, or sale of assets, your data may be transferred 
                as part of that transaction.
              </p>
            </section>

            <Separator className="my-6" />

            {/* International Transfers */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">7. International Data Transfers</h2>
              <p className="text-muted-foreground mb-4">
                As CubaDate connects users between Canada and Cuba, your personal data may be transferred to 
                and processed in countries outside your country of residence. We implement appropriate safeguards 
                to protect your data during these transfers, including:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2 mb-4">
                <li>Standard Contractual Clauses approved by the European Commission</li>
                <li>Adequacy decisions for transfers to countries with adequate protection</li>
                <li>Binding corporate rules for internal transfers</li>
                <li>Technical and organizational security measures</li>
              </ul>
            </section>

            <Separator className="my-6" />

            {/* Data Security */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">8. Data Security</h2>
              <p className="text-muted-foreground mb-4">
                We have implemented appropriate security measures to prevent your personal data from being 
                accidentally lost, used, accessed in an unauthorized way, altered, or disclosed. These include:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2 mb-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication mechanisms</li>
                <li>Regular security assessments and penetration testing</li>
                <li>Access controls and employee training</li>
                <li>Incident response procedures</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                While we implement strong security measures, no method of transmission over the internet or 
                electronic storage is 100% secure. We cannot guarantee absolute security.
              </p>
            </section>

            <Separator className="my-6" />

            {/* Data Retention */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">9. Data Retention</h2>
              <p className="text-muted-foreground mb-4">
                We retain your personal data for as long as necessary to provide our services and fulfill 
                the purposes described in this policy. Specific retention periods include:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2 mb-4">
                <li><strong>Account Data:</strong> Retained while your account is active</li>
                <li><strong>After Deletion:</strong> 90 days safety retention period to protect the community</li>
                <li><strong>Transaction Records:</strong> 7 years as required by tax law</li>
                <li><strong>Safety Records:</strong> May be retained longer to prevent abuse and comply with legal obligations</li>
                <li><strong>Anonymized Data:</strong> May be retained indefinitely for analytics and research</li>
              </ul>
            </section>

            <Separator className="my-6" />

            {/* Your Rights (GDPR) */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">10. Your Legal Rights</h2>
              <p className="text-muted-foreground mb-4">
                Under data protection laws, you have rights in relation to your personal data:
              </p>
              
              <div className="space-y-4">
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Right of Access</h4>
                  <p className="text-muted-foreground text-sm">
                    You have the right to request a copy of the personal data we hold about you.
                  </p>
                </div>
                
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Right to Rectification</h4>
                  <p className="text-muted-foreground text-sm">
                    You have the right to request that we correct any inaccurate or incomplete personal data.
                  </p>
                </div>
                
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Right to Erasure</h4>
                  <p className="text-muted-foreground text-sm">
                    You have the right to request that we delete your personal data in certain circumstances.
                  </p>
                </div>
                
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Right to Restrict Processing</h4>
                  <p className="text-muted-foreground text-sm">
                    You have the right to request that we limit the processing of your personal data.
                  </p>
                </div>
                
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Right to Data Portability</h4>
                  <p className="text-muted-foreground text-sm">
                    You have the right to request a copy of your data in a machine-readable format.
                  </p>
                </div>
                
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Right to Object</h4>
                  <p className="text-muted-foreground text-sm">
                    You have the right to object to processing based on legitimate interests or for marketing purposes.
                  </p>
                </div>
                
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Right to Withdraw Consent</h4>
                  <p className="text-muted-foreground text-sm">
                    Where we rely on consent, you can withdraw it at any time without affecting the lawfulness 
                    of prior processing.
                  </p>
                </div>
              </div>
              
              <p className="text-muted-foreground mt-4">
                To exercise any of these rights, please contact us at privacy@cubadate.com. We will respond 
                within one month (or longer if the request is complex, in which case we will inform you).
              </p>
            </section>

            <Separator className="my-6" />

            {/* Cookies */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">11. Cookies and Tracking Technologies</h2>
              <p className="text-muted-foreground mb-4">
                We use cookies and similar tracking technologies to collect and track information about your 
                browsing activity. For detailed information about the cookies we use and your choices regarding 
                cookies, please see our Cookie Policy.
              </p>
            </section>

            <Separator className="my-6" />

            {/* Children's Privacy */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">12. Children's Privacy</h2>
              <p className="text-muted-foreground mb-4">
                Our services are not intended for individuals under the age of 18. We do not knowingly collect 
                personal data from children. If we become aware that we have collected personal data from a 
                child without parental consent, we will take steps to delete that information.
              </p>
            </section>

            <Separator className="my-6" />

            {/* Changes to Policy */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">13. Changes to This Privacy Policy</h2>
              <p className="text-muted-foreground mb-4">
                We may update this privacy policy from time to time. We will notify you of any material changes 
                by posting the new privacy policy on this page and updating the "Effective Date" at the top. 
                We encourage you to review this policy periodically.
              </p>
            </section>

            <Separator className="my-6" />

            {/* Regional Notices */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">14. Regional Privacy Notices</h2>
              
              <div className="bg-muted p-4 rounded-xl mb-4">
                <h3 className="font-semibold text-foreground mb-2">🇪🇺 European Economic Area (EEA) Users</h3>
                <p className="text-muted-foreground text-sm">
                  If you are located in the EEA, you have the right to lodge a complaint with your local 
                  supervisory authority if you believe your data protection rights have been violated.
                </p>
              </div>
              
              <div className="bg-muted p-4 rounded-xl mb-4">
                <h3 className="font-semibold text-foreground mb-2">🇨🇦 Canadian Users</h3>
                <p className="text-muted-foreground text-sm">
                  This privacy policy complies with the Personal Information Protection and Electronic Documents 
                  Act (PIPEDA). You may contact the Office of the Privacy Commissioner of Canada at www.priv.gc.ca 
                  for more information.
                </p>
              </div>
              
              <div className="bg-muted p-4 rounded-xl mb-4">
                <h3 className="font-semibold text-foreground mb-2">🇺🇸 California Users (CCPA)</h3>
                <p className="text-muted-foreground text-sm">
                  California residents have additional rights under the California Consumer Privacy Act (CCPA), 
                  including the right to know what personal information is collected and the right to opt-out 
                  of the sale of personal information. We do not sell your personal information.
                </p>
              </div>
              
              <div className="bg-muted p-4 rounded-xl mb-4">
                <h3 className="font-semibold text-foreground mb-2">🇨🇺 Cuban Users</h3>
                <p className="text-muted-foreground text-sm">
                  We comply with applicable Cuban data protection regulations. Your data is processed in 
                  accordance with local requirements and international standards.
                </p>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Contact Us */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">15. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this privacy policy or our privacy practices, please contact us:
              </p>
              <div className="bg-primary/10 p-4 rounded-xl">
                <p className="text-foreground font-medium">CubaDate Privacy Team</p>
                <p className="text-muted-foreground">Email: privacy@cubadate.com</p>
                <p className="text-muted-foreground">Website: www.cubadate.com/privacy</p>
                <p className="text-muted-foreground mt-2">
                  Response time: Within 30 days for general inquiries, within 72 hours for data breach notifications.
                </p>
              </div>
            </section>

            <div className="h-8" />
          </div>
        </ScrollArea>
      </div>
    </AuthLayout>
  );
}
