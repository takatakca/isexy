import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { 
  Send, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  MessageCircle,
  HelpCircle,
  AlertCircle,
  CreditCard,
  Shield,
  Users,
  Heart
} from "lucide-react";

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "",
    subject: "",
    message: "",
    priority: "normal"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { value: "general", label: "General Inquiry", icon: HelpCircle },
    { value: "technical", label: "Technical Support", icon: AlertCircle },
    { value: "billing", label: "Billing & Payments", icon: CreditCard },
    { value: "safety", label: "Safety & Security", icon: Shield },
    { value: "account", label: "Account Issues", icon: Users },
    { value: "feedback", label: "Feedback & Suggestions", icon: Heart },
    { value: "report", label: "Report a Problem", icon: AlertCircle },
    { value: "partnership", label: "Partnership Inquiry", icon: MessageCircle },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.category || !formData.subject || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success("Your message has been sent successfully! We'll get back to you within 24-48 hours.");
    setFormData({
      name: "",
      email: "",
      category: "",
      subject: "",
      message: "",
      priority: "normal"
    });
    setIsSubmitting(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col pb-20">
        {/* Header */}
        <div className="text-center mb-8">
          <Logo size="lg" showText={false} variant="dark" />
          <h1 className="text-3xl font-bold text-foreground mt-4">Contact Us</h1>
          <p className="text-muted-foreground mt-2">
            We're here to help. Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        {/* Contact Info Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-sm">Email</h3>
            <p className="text-xs text-muted-foreground mt-1">support@cubadate.com</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-sm">Response Time</h3>
            <p className="text-xs text-muted-foreground mt-1">24-48 hours</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-sm">Headquarters</h3>
            <p className="text-xs text-muted-foreground mt-1">Miami, FL, USA</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-sm">Phone</h3>
            <p className="text-xs text-muted-foreground mt-1">+1 (305) 555-DATE</p>
          </div>
        </div>

        {/* Support Form */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Submit a Support Ticket
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-foreground">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => handleChange("category", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className="w-4 h-4" />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-foreground">Priority Level</Label>
              <div className="flex gap-2">
                {["low", "normal", "high", "urgent"].map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => handleChange("priority", priority)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                      formData.priority === priority
                        ? priority === "urgent"
                          ? "bg-destructive text-white"
                          : priority === "high"
                          ? "bg-orange-500 text-white"
                          : priority === "normal"
                          ? "bg-primary text-white"
                          : "bg-muted-foreground text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-foreground">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subject"
                placeholder="Brief description of your issue"
                value={formData.subject}
                onChange={(e) => handleChange("subject", e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message" className="text-foreground">
                Message <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="message"
                placeholder="Please describe your issue or question in detail. Include any relevant information that may help us assist you better."
                value={formData.message}
                onChange={(e) => handleChange("message", e.target.value)}
                className="bg-background min-h-[150px]"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-white hover:bg-primary/90 py-6"
            >
              {isSubmitting ? (
                "Sending..."
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Submit Ticket
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-8 space-y-4">
          <div className="bg-muted/50 rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-2">Before You Submit</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Check our <a href="/faq" className="text-primary underline">FAQ section</a> for quick answers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Review our <a href="/safety" className="text-primary underline">Safety Center</a> for safety-related issues
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                For urgent safety concerns, use the in-app report feature
              </li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-2">What to Expect</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">1.</span>
                You'll receive a confirmation email with your ticket number
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">2.</span>
                Our support team will review your request within 24-48 hours
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">3.</span>
                We'll respond via email with a solution or follow-up questions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">4.</span>
                You can reply to continue the conversation on your ticket
              </li>
            </ul>
          </div>
        </div>

        {/* Office Hours */}
        <div className="mt-8 bg-card border border-border rounded-xl p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Support Hours
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-foreground">Monday - Friday</p>
              <p className="text-muted-foreground">9:00 AM - 9:00 PM EST</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Saturday</p>
              <p className="text-muted-foreground">10:00 AM - 6:00 PM EST</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Sunday</p>
              <p className="text-muted-foreground">12:00 PM - 5:00 PM EST</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Holidays</p>
              <p className="text-muted-foreground">Limited support available</p>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm mb-3">Follow us for updates and tips</p>
          <div className="flex justify-center gap-4">
            <button className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
            </button>
            <button className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </button>
            <button className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default ContactUs;
