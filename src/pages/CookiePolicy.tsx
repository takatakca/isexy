import { AuthLayout } from "@/components/AuthLayout";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function CookiePolicy() {
  return (
    <AuthLayout showBack variant="white">
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-6 pr-4">
          <p className="text-muted-foreground">
            At CubaDate, we believe in being clear and open about how we collect and process data about you. 
            This page is designed to inform you about our practices regarding cookies and explain to you how 
            you can manage them.
          </p>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-2">What are cookies?</h3>
            <p className="text-muted-foreground text-sm">
              Cookies are small text files that are sent to or accessed from your web browser or your device's 
              memory. A cookie typically contains the name of the domain (internet location) from which the 
              cookie originated, the "lifetime" of the cookie (i.e., when it expires) and a randomly generated 
              unique number or similar identifier.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-2">Types of Cookies</h3>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-foreground text-sm">First-party and third-party cookies</h4>
                <p className="text-muted-foreground text-sm">
                  There are first-party cookies and third-party cookies. First-party cookies are placed on 
                  your device directly by us. Third-party cookies are placed on your device by our partners 
                  and service providers.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground text-sm">Session and persistent cookies</h4>
                <p className="text-muted-foreground text-sm">
                  Session cookies only last until you close your browser. We use session cookies for a variety 
                  of reasons, including to learn more about your use of our website during one single browser 
                  session. Persistent cookies have a longer lifespan and last beyond the current session.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-2">What do we use cookies for?</h3>
            <p className="text-muted-foreground text-sm mb-3">
              Like other providers of online services, we use cookies to provide, secure and improve our services, 
              including by remembering your preferences, recognizing you when you visit our website, and 
              personalizing content.
            </p>

            <div className="space-y-3">
              <div className="bg-muted/50 p-3 rounded-lg">
                <h4 className="font-semibold text-foreground text-sm">Essential cookies</h4>
                <p className="text-muted-foreground text-xs">
                  Strictly necessary to provide you our services, such as enabling you to log in and keeping you safe.
                </p>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <h4 className="font-semibold text-foreground text-sm">Analytics cookies</h4>
                <p className="text-muted-foreground text-xs">
                  Help us understand how our services are being used and help us customize and improve our services.
                </p>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <h4 className="font-semibold text-foreground text-sm">Advertising & marketing cookies</h4>
                <p className="text-muted-foreground text-xs">
                  Used to determine how effective our marketing campaigns are and make ads more relevant to you.
                </p>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <h4 className="font-semibold text-foreground text-sm">Social networking cookies</h4>
                <p className="text-muted-foreground text-xs">
                  Enable you to share pages and content through third-party social networking websites.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-2">How can you control cookies?</h3>
            <p className="text-muted-foreground text-sm">
              You can set and adjust your cookies preferences at any time by using the tool available in our app 
              settings. Some web browsers provide settings that allow you to control or reject cookies. You also 
              may be able to reset device identifiers by using the appropriate setting on your mobile device.
            </p>
          </div>

          <div className="pb-8">
            <h3 className="text-lg font-bold text-foreground mb-2">Contact Us</h3>
            <p className="text-muted-foreground text-sm">
              If you have questions about this Cookie Policy, you can contact us through our support channels.
            </p>
          </div>
        </div>
      </ScrollArea>
    </AuthLayout>
  );
}
