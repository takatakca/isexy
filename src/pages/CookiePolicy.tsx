import { AuthLayout } from "@/components/AuthLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Cookie, Shield, BarChart3, Target, Settings, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function CookiePolicy() {
  const [essentialCookies] = useState(true);
  const [analyticsCookies, setAnalyticsCookies] = useState(true);
  const [marketingCookies, setMarketingCookies] = useState(false);
  const [functionalCookies, setFunctionalCookies] = useState(true);

  const handleSavePreferences = () => {
    localStorage.setItem('cookiePreferences', JSON.stringify({
      essential: essentialCookies,
      analytics: analyticsCookies,
      marketing: marketingCookies,
      functional: functionalCookies,
    }));
    toast.success("Cookie preferences saved!");
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1">
        <h1 className="text-3xl font-extrabold text-foreground mb-2">Cookie Policy</h1>
        <p className="text-muted-foreground mb-6">Last updated: December 24, 2024</p>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="prose prose-sm max-w-none text-foreground pr-4">
            
            {/* Introduction */}
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Cookie className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold m-0">What Are Cookies?</h2>
              </div>
              <p className="text-muted-foreground mb-4">
                Cookies are small text files that are stored on your device (computer, tablet, or mobile) 
                when you visit our website or use our application. They help us provide you with a better 
                experience by remembering your preferences, understanding how you use our service, and 
                improving our features.
              </p>
              <p className="text-muted-foreground mb-4">
                This Cookie Policy explains what cookies are, how we use them, the types of cookies we use, 
                the information we collect using cookies, and how you can control your cookie preferences.
              </p>
            </section>

            <Separator className="my-6" />

            {/* How We Use Cookies */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">How We Use Cookies</h2>
              <p className="text-muted-foreground mb-4">
                We use cookies and similar tracking technologies for the following purposes:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-2 mb-4">
                <li>To keep you signed in to your account</li>
                <li>To remember your preferences and settings</li>
                <li>To understand how you use our service</li>
                <li>To improve our app and develop new features</li>
                <li>To deliver relevant content and advertisements</li>
                <li>To measure the effectiveness of our marketing campaigns</li>
                <li>To detect and prevent fraud and security threats</li>
              </ul>
            </section>

            <Separator className="my-6" />

            {/* Types of Cookies */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">Types of Cookies We Use</h2>
              
              {/* Essential Cookies */}
              <div className="bg-muted p-4 rounded-xl mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-foreground m-0">Essential Cookies</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Required</span>
                    <Switch checked={essentialCookies} disabled />
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-3">
                  These cookies are necessary for the website to function properly. They enable core 
                  functionality such as security, network management, and account access. You cannot 
                  disable these cookies.
                </p>
                <div className="bg-background p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Examples:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Session cookies for authentication</li>
                    <li>• Security tokens to prevent CSRF attacks</li>
                    <li>• Load balancing cookies</li>
                  </ul>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="bg-muted p-4 rounded-xl mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-foreground m-0">Analytics Cookies</h3>
                  </div>
                  <Switch 
                    checked={analyticsCookies} 
                    onCheckedChange={setAnalyticsCookies}
                  />
                </div>
                <p className="text-muted-foreground text-sm mb-3">
                  These cookies help us understand how visitors interact with our website by collecting 
                  and reporting information anonymously. This helps us improve our service.
                </p>
                <div className="bg-background p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Examples:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Google Analytics</li>
                    <li>• Mixpanel</li>
                    <li>• Amplitude</li>
                    <li>• Firebase Analytics</li>
                  </ul>
                </div>
              </div>

              {/* Functional Cookies */}
              <div className="bg-muted p-4 rounded-xl mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-foreground m-0">Functional Cookies</h3>
                  </div>
                  <Switch 
                    checked={functionalCookies} 
                    onCheckedChange={setFunctionalCookies}
                  />
                </div>
                <p className="text-muted-foreground text-sm mb-3">
                  These cookies enable enhanced functionality and personalization. They may be set by us 
                  or by third-party providers whose services we have added to our pages.
                </p>
                <div className="bg-background p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Examples:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Language preferences</li>
                    <li>• Theme preferences (dark/light mode)</li>
                    <li>• Chat widget settings</li>
                    <li>• Video player preferences</li>
                  </ul>
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="bg-muted p-4 rounded-xl mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-foreground m-0">Marketing Cookies</h3>
                  </div>
                  <Switch 
                    checked={marketingCookies} 
                    onCheckedChange={setMarketingCookies}
                  />
                </div>
                <p className="text-muted-foreground text-sm mb-3">
                  These cookies are used to track visitors across websites. The intention is to display 
                  ads that are relevant and engaging for the individual user.
                </p>
                <div className="bg-background p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Examples:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Facebook Pixel</li>
                    <li>• Google Ads</li>
                    <li>• Twitter conversion tracking</li>
                    <li>• LinkedIn Insight Tag</li>
                  </ul>
                </div>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Cookie List */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">Specific Cookies We Use</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-semibold text-foreground">Cookie Name</th>
                      <th className="text-left p-3 font-semibold text-foreground">Purpose</th>
                      <th className="text-left p-3 font-semibold text-foreground">Duration</th>
                      <th className="text-left p-3 font-semibold text-foreground">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="p-3 text-muted-foreground">sb-access-token</td>
                      <td className="p-3 text-muted-foreground">Authentication session</td>
                      <td className="p-3 text-muted-foreground">Session</td>
                      <td className="p-3"><span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Essential</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 text-muted-foreground">sb-refresh-token</td>
                      <td className="p-3 text-muted-foreground">Token refresh</td>
                      <td className="p-3 text-muted-foreground">7 days</td>
                      <td className="p-3"><span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Essential</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 text-muted-foreground">_ga</td>
                      <td className="p-3 text-muted-foreground">Google Analytics ID</td>
                      <td className="p-3 text-muted-foreground">2 years</td>
                      <td className="p-3"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Analytics</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 text-muted-foreground">_gid</td>
                      <td className="p-3 text-muted-foreground">Google Analytics session</td>
                      <td className="p-3 text-muted-foreground">24 hours</td>
                      <td className="p-3"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Analytics</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 text-muted-foreground">theme</td>
                      <td className="p-3 text-muted-foreground">Dark/light mode preference</td>
                      <td className="p-3 text-muted-foreground">1 year</td>
                      <td className="p-3"><span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Functional</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 text-muted-foreground">locale</td>
                      <td className="p-3 text-muted-foreground">Language preference</td>
                      <td className="p-3 text-muted-foreground">1 year</td>
                      <td className="p-3"><span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Functional</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 text-muted-foreground">_fbp</td>
                      <td className="p-3 text-muted-foreground">Facebook tracking</td>
                      <td className="p-3 text-muted-foreground">90 days</td>
                      <td className="p-3"><span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Marketing</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Third-Party Cookies */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">Third-Party Cookies</h2>
              <p className="text-muted-foreground mb-4">
                In addition to our own cookies, we may also use various third-party cookies to report 
                usage statistics of the Service, deliver advertisements on and through the Service, and so on.
              </p>
              <div className="space-y-3">
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Google</h4>
                  <p className="text-muted-foreground text-sm">
                    Analytics, Ads, Firebase - Used for analytics, advertising, and app functionality.
                  </p>
                </div>
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Facebook/Meta</h4>
                  <p className="text-muted-foreground text-sm">
                    Pixel, SDK - Used for social login and advertising optimization.
                  </p>
                </div>
                <div className="border border-border p-4 rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">Stripe</h4>
                  <p className="text-muted-foreground text-sm">
                    Payment processing - Essential for secure payment handling.
                  </p>
                </div>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Managing Cookies */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">How to Manage Cookies</h2>
              
              <div className="bg-muted p-4 rounded-xl mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <Info className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground m-0">Browser Settings</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-3">
                  Most web browsers allow you to control cookies through their settings. You can:
                </p>
                <ul className="text-muted-foreground text-sm space-y-2">
                  <li>• Block all cookies</li>
                  <li>• Block only third-party cookies</li>
                  <li>• Delete cookies when you close your browser</li>
                  <li>• Get notifications when a cookie is set</li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-medium">Browser-specific instructions:</p>
                <div className="grid grid-cols-2 gap-3">
                  <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" 
                     className="border border-border p-3 rounded-lg text-center hover:bg-muted transition-colors">
                    <span className="text-foreground font-medium text-sm">Chrome</span>
                  </a>
                  <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer"
                     className="border border-border p-3 rounded-lg text-center hover:bg-muted transition-colors">
                    <span className="text-foreground font-medium text-sm">Firefox</span>
                  </a>
                  <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer"
                     className="border border-border p-3 rounded-lg text-center hover:bg-muted transition-colors">
                    <span className="text-foreground font-medium text-sm">Safari</span>
                  </a>
                  <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer"
                     className="border border-border p-3 rounded-lg text-center hover:bg-muted transition-colors">
                    <span className="text-foreground font-medium text-sm">Edge</span>
                  </a>
                </div>
              </div>
            </section>

            <Separator className="my-6" />

            {/* Cookie Preferences */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">Your Cookie Preferences</h2>
              <p className="text-muted-foreground mb-4">
                Use the toggles above to customize your cookie preferences. Your choices will be saved 
                and applied to your browsing experience.
              </p>
              
              <button
                onClick={handleSavePreferences}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Save Cookie Preferences
              </button>
            </section>

            <Separator className="my-6" />

            {/* Do Not Track */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">Do Not Track Signals</h2>
              <p className="text-muted-foreground mb-4">
                Some browsers have a "Do Not Track" feature that lets you tell websites that you do not 
                want to have your online activities tracked. We currently respond to Do Not Track signals 
                by disabling non-essential cookies when detected.
              </p>
            </section>

            <Separator className="my-6" />

            {/* Changes to Policy */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">Changes to This Cookie Policy</h2>
              <p className="text-muted-foreground mb-4">
                We may update this Cookie Policy from time to time. We will notify you of any changes by 
                posting the new Cookie Policy on this page and updating the "Last updated" date at the top.
              </p>
            </section>

            <Separator className="my-6" />

            {/* Contact */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about our use of cookies or this Cookie Policy, please contact us:
              </p>
              <div className="bg-primary/10 p-4 rounded-xl">
                <p className="text-foreground font-medium">CubaDate Privacy Team</p>
                <p className="text-muted-foreground">Email: privacy@cubadate.com</p>
                <p className="text-muted-foreground">Website: www.cubadate.com/cookies</p>
              </div>
            </section>

            <div className="h-8" />
          </div>
        </ScrollArea>
      </div>
    </AuthLayout>
  );
}
