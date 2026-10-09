import { AuthLayout } from "@/components/AuthLayout";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SafetyTips() {
  return (
    <AuthLayout showBack variant="white">
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-6 pr-4">
          <p className="text-muted-foreground">
            Meeting new people is exciting, but you should always be cautious when interacting with someone 
            you don't know. Use your best judgment and put your safety first, whether you're sending your 
            first message or meeting in-person.
          </p>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">Online Safety</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground">Never send money or share financial information</h4>
                <p className="text-muted-foreground text-sm">
                  Never send money, whether it's through wire transfer, banking service, or an app on your phone, 
                  even if the person claims to be in an emergency. Don't make investments, buy gift cards or crypto, 
                  or open accounts because someone you met online asked you to.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Protect your personal information</h4>
                <p className="text-muted-foreground text-sm">
                  Never share personal information, such as your home or work address, or details about your 
                  daily routine with people you don't know. If you're a parent, limit the information that you 
                  share about your children.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Stay on the platform</h4>
                <p className="text-muted-foreground text-sm">
                  Keep conversations on the ISEXY platform while you're getting to know someone. Users with 
                  bad intentions often try to move the conversation to text, messaging apps, email, or phone right away.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Be wary of people who need urgent help</h4>
                <p className="text-muted-foreground text-sm">
                  Watch out for scammers who claim to be from your country but stuck somewhere else, especially 
                  if they ask for financial help to return home.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Report suspicious behavior</h4>
                <p className="text-muted-foreground text-sm">
                  You know when someone's crossed the line. Block and report anyone that violates our terms or 
                  your personal boundaries.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">Meeting In-Person</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground">Don't be in a rush</h4>
                <p className="text-muted-foreground text-sm">
                  Take your time and get to know the other person before agreeing to meet or chat off-ISEXY. 
                  Don't be afraid to ask questions to screen for any red flags or personal dealbreakers.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Meet in public and stay in public</h4>
                <p className="text-muted-foreground text-sm">
                  If you decide to meet someone from ISEXY, meet in a populated, public place — never at your home, 
                  their home, or any other private location. If they pressure you to go somewhere private, leave.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Tell friends and family about your plans</h4>
                <p className="text-muted-foreground text-sm">
                  Tell a friend or family member of your plans, including when and where you're going. Have your 
                  cell phone charged and with you at all times.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Be in control of your transportation</h4>
                <p className="text-muted-foreground text-sm">
                  We want you to be in control of how you get to and from a meetup so that you can leave 
                  whenever you want.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Know your limits</h4>
                <p className="text-muted-foreground text-sm">
                  Be aware of the effects of drugs or alcohol on you specifically — they can impair your 
                  judgment and your alertness.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Don't leave drinks unattended</h4>
                <p className="text-muted-foreground text-sm">
                  Know where your drink comes from and know where it is at all times — only accept drinks 
                  poured or served directly from the bartender or server.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">If you feel uncomfortable, leave</h4>
                <p className="text-muted-foreground text-sm">
                  It's okay to end a meetup early if you're feeling uncomfortable. In fact, it's encouraged. 
                  And if your instincts are telling you something is off or you feel unsafe, ask for help.
                </p>
              </div>
            </div>
          </div>

          <div className="pb-8">
            <h3 className="text-lg font-bold text-foreground mb-3">Boundaries & Consent</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground">Respect boundaries</h4>
                <p className="text-muted-foreground text-sm">
                  ISEXY is for meeting new people and making friends. If someone says no, changes the subject 
                  or stops replying, respect it and move on.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Protect private images</h4>
                <p className="text-muted-foreground text-sm">
                  Never share intimate images of someone without their consent — in Canada it is a crime. 
                  If someone threatens to share your images or asks for money, stop replying, keep the 
                  evidence, report them on ISEXY and contact the police.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground">Consent</h4>
                <p className="text-muted-foreground text-sm">
                  Any physical contact must start with clear consent, and consent can be withdrawn at any time. 
                  Nobody owes anyone anything because of a chat, a call or a meetup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </AuthLayout>
  );
}
