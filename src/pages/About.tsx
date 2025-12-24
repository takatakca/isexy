import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Shield, Globe, Users, Sparkles, BadgeCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

const stats = [
  { value: "190+", label: "Countries" },
  { value: "75M+", label: "Active Users" },
  { value: "100B+", label: "Matches Made" },
  { value: "3 sec", label: "New Match Every" },
];

const values = [
  {
    icon: Heart,
    title: "Real Connections",
    description: "We believe in fostering genuine relationships, not just swipes. Our platform is designed to help you find meaningful connections.",
  },
  {
    icon: Shield,
    title: "Safety First",
    description: "Your safety is our priority. From photo verification to in-app safety features, we're committed to creating a secure environment.",
  },
  {
    icon: Users,
    title: "Inclusive Community",
    description: "CubaDate welcomes everyone. We celebrate diversity and are committed to making our platform accessible to all.",
  },
  {
    icon: Sparkles,
    title: "Innovation",
    description: "We're constantly evolving with new features like AI-powered matching, video profiles, and more to help you connect.",
  },
];

const features = [
  {
    icon: BadgeCheck,
    title: "Photo Verification",
    description: "Face Check™ technology helps confirm users are real and match their profile photos.",
  },
  {
    icon: Globe,
    title: "Passport Mode",
    description: "Connect with people anywhere in the world before you even arrive at your destination.",
  },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">About CubaDate</h1>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 py-12 text-center bg-gradient-to-b from-primary/10 to-background">
        <div className="flex justify-center mb-6">
          <Logo size="xl" variant="dark" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Where Sparks Fly
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Launched to revolutionize how people meet, CubaDate has become the world's most popular app for meeting new people. We're on a mission to bring people together.
        </p>
      </div>

      {/* Stats */}
      <div className="px-4 py-8">
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-2xl p-4 text-center border border-border"
            >
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Our Values */}
      <div className="px-4 py-8">
        <h3 className="text-xl font-bold text-foreground mb-6">Our Values</h3>
        <div className="space-y-4">
          {values.map((value) => (
            <div
              key={value.title}
              className="flex gap-4 p-4 bg-card rounded-2xl border border-border"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <value.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">{value.title}</h4>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Features */}
      <div className="px-4 py-8 bg-muted/30">
        <h3 className="text-xl font-bold text-foreground mb-6">Key Features</h3>
        <div className="space-y-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex gap-4 p-4 bg-card rounded-2xl border border-border"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Success Stories CTA */}
      <div className="px-4 py-8">
        <div className="bg-gradient-to-r from-primary to-rose-500 rounded-2xl p-6 text-center">
          <Heart className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold text-primary-foreground mb-2">
            Love Stories
          </h3>
          <p className="text-primary-foreground/80 mb-4">
            Explore real stories from couples who found love on CubaDate.
          </p>
          <button
            onClick={() => navigate("/love-stories")}
            className="px-6 py-3 bg-white text-primary rounded-full font-bold"
          >
            Read Stories
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-8 text-center border-t border-border">
        <p className="text-sm text-muted-foreground mb-4">
          © 2025 CubaDate. All rights reserved.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate("/terms")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Terms
          </button>
          <button
            onClick={() => navigate("/privacy")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Privacy
          </button>
          <button
            onClick={() => navigate("/safety")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Safety
          </button>
        </div>
      </div>
    </div>
  );
}
