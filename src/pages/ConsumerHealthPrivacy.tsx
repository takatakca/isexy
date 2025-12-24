import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ConsumerHealthPrivacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary px-4 py-5">
        <button 
          onClick={() => navigate(-1)}
          className="text-primary-foreground flex items-center gap-1"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-primary-foreground text-xl font-medium mt-2">
          Consumer Health Data Privacy Policy
        </h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        <p className="text-muted-foreground text-sm">
          This Consumer Health Data Privacy Policy supplements our Privacy Policy and is intended only for residents of Washington and Nevada.
        </p>

        {/* Collection and Use Section */}
        <section>
          <h2 className="text-foreground font-semibold text-lg mb-3">
            Collection and Use of Consumer Health Data
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We do not believe we collect "consumer health data," and we do not use data we collect to identify or make inferences about your past, present, or future physical or mental health status. Because "consumer health data" is defined so broadly in some jurisdictions, however, the information we may collect from or about you from time to time may be considered "consumer health data" under laws in those jurisdictions. Like other data we collect, the main reason we use this information is to provide our service to you and help you connect with other members.
          </p>
        </section>

        {/* How We Disclose Section */}
        <section>
          <h2 className="text-foreground font-semibold text-lg mb-3">
            How We Disclose Consumer Health Data
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            We may share consumer health data with the following categories of third parties when necessary for the purposes described above:
          </p>

          <div className="space-y-4">
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-foreground font-medium mb-2">Other users</h3>
              <p className="text-muted-foreground text-sm">
                You share information with other users when you voluntarily disclose information on the service for others to see (e.g., your public profile).
              </p>
            </div>

            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-foreground font-medium mb-2">Service providers</h3>
              <p className="text-muted-foreground text-sm">
                We share information with vendors who help us operate our service. They provide us services such as data hosting and maintenance, customer care, and security operations.
              </p>
            </div>

            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-foreground font-medium mb-2">Affiliates</h3>
              <p className="text-muted-foreground text-sm">
                We may share information with affiliates who assist us in data processing operations, as service providers. This assistance may include processing operations, such as data hosting and maintenance, customer care, data security and fighting against spam, abuse, fraud and other wrongdoings.
              </p>
            </div>

            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-foreground font-medium mb-2">Parties to a corporate transaction</h3>
              <p className="text-muted-foreground text-sm">
                We may disclose your information if we are involved, whether in whole or in part, in a merger, sale, acquisition, divestiture, restructuring, reorganization, dissolution, bankruptcy or other change of ownership or control.
              </p>
            </div>

            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-foreground font-medium mb-2">Law enforcement authorities / Legal Processes</h3>
              <p className="text-muted-foreground text-sm">
                We may disclose your data to: (i) comply with a legal process, such as a court order, subpoena or search warrant, government / law enforcement investigation or other legal requirements; (ii) assist in the prevention or detection of crime; (iii) protect the safety of any person; and (iv) establish, exercise or defend legal claims.
              </p>
            </div>
          </div>
        </section>

        {/* Your Rights Section */}
        <section>
          <h2 className="text-foreground font-semibold text-lg mb-3">
            Your Rights
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You can exercise your privacy rights under applicable law by submitting a request to our customer care team through the Help & Support section of the app.
          </p>
        </section>
      </div>
    </div>
  );
}
