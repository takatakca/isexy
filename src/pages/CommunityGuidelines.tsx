import { AuthLayout } from "@/components/AuthLayout";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function CommunityGuidelines() {
  return (
    <AuthLayout showBack variant="white">
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-6 pr-4">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Welcome to CubaDate!</h2>
            <p className="text-muted-foreground">
              CubaDate is where meaningful connections can happen. It Starts With a Swipe™. Sometimes you click. 
              Sometimes you don't. And sometimes the talking leads to more. Opportunity is overflowing. 
              Possibilities are endless. All (adults) are welcome to come explore.
            </p>
          </div>

          <p className="text-muted-foreground">
            We want CubaDate to be a fun, safe and inclusive space where anyone can be themselves while getting 
            to know others. That's what these Community Guidelines are for–to set expectations for everyone's 
            behavior, both on and off the app.
          </p>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">CubaDate's Rules:</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground">1. Consider boundaries</h4>
                <p className="text-muted-foreground text-sm">
                  Comfort levels vary from person to person. That's why we don't allow nudity, sexual content, 
                  sexual desires, or looking for sex on your public profile. If you are in a private conversation, 
                  these are okay if everyone is okay with it. Consent matters.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">2. Share cautiously and thoughtfully</h4>
                <p className="text-muted-foreground text-sm">
                  Don't publicly broadcast your personal information or ways for people to connect with you 
                  (no public displays of things like phone numbers, emails, or social handles). Be cautious, 
                  if someone asks you to send them money or tries to get you to make an investment, it's probably a scam.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">3. Steer clear of violent content</h4>
                <p className="text-muted-foreground text-sm">
                  We promote positivity and won't tolerate any sort of violent content that contains gore, death, 
                  images or descriptions of violent acts, use of weapons, and anything advocating or glorifying self-harm.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">4. Make personal connections, not biz ones</h4>
                <p className="text-muted-foreground text-sm">
                  Don't advertise, promote, share your social handles to gain followers, sell stuff, fundraise, 
                  or campaign. This also means CubaDate isn't the place for any sort of sex work, escort services, 
                  or compensated relationships.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">5. Just be you</h4>
                <p className="text-muted-foreground text-sm">
                  People want to meet the real you. Not your fake persona. Don't create a fake account or pretend 
                  to be someone you're not, even if it's just for fun.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">6. Communicate Respectfully</h4>
                <p className="text-muted-foreground text-sm">
                  Talking to new people can be tricky, especially when you're interacting with humans from all 
                  walks of life. Respect goes a long way. Harassment, threats, bullying, intimidation, doxing, 
                  or anything intentionally done to cause harm is not allowed.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">7. Lead with kindness, not harm</h4>
                <p className="text-muted-foreground text-sm">
                  Any acts or behavior that suggests, intends, or causes harm to another user - either on or offline, 
                  physically or digitally - will be taken very seriously. This includes anything calling for or inciting harm.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">8. Adults only</h4>
                <p className="text-muted-foreground text-sm">
                  You must be 18 years of age or older to use CubaDate. This also means we don't allow photos of 
                  unaccompanied or unclothed minors.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">9. Abide by the law</h4>
                <p className="text-muted-foreground text-sm">
                  No illegal content or activities are allowed, ever. This means you can't use CubaDate to buy or 
                  sell drugs or counterfeit goods, or ask for assistance to help you break the law.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">10. One person, one account</h4>
                <p className="text-muted-foreground text-sm">
                  Each account can only have one owner. For logistic and privacy reasons, we can't support multiple 
                  people accessing the same account, each individual needs to have their own.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">11. This is your space, post your own content</h4>
                <p className="text-muted-foreground text-sm">
                  Don't post images or private messages from other people unless you've been given consent to do so. 
                  Don't post work that's copyrighted or trademarked by others.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">12. Be a good CubaDate user</h4>
                <p className="text-muted-foreground text-sm">
                  Don't abuse CubaDate. Don't use CubaDate to spread false or misleading information. Don't spam 
                  harmful links or unsolicited content. Don't submit false, misleading, or malicious reports.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-2">Reporting</h3>
            <p className="text-muted-foreground text-sm">
              As a member of the CubaDate community, we encourage you to speak up and speak out. If someone is 
              causing you harm or is violating our Community Guidelines–report it. Your report is always treated 
              as confidential. By reporting, you can help us stop harmful behavior and protect others.
            </p>
          </div>

          <div className="pb-8">
            <h3 className="text-lg font-bold text-foreground mb-2">Impact</h3>
            <p className="text-muted-foreground text-sm">
              We take our Community Guidelines and the impact they have on our community seriously. We'll do 
              everything we can to make sure people follow them. We have a warning system in place, but if 
              violations continue or if the violation is severe, we will respond accordingly.
            </p>
          </div>
        </div>
      </ScrollArea>
    </AuthLayout>
  );
}
