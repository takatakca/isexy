import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Shield, Globe, Users, Sparkles, BadgeCheck, MapPin, Award, Target, Zap, Star, MessageCircle, Lock, Eye } from "lucide-react";
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
    description: "We believe in fostering genuine relationships, not just swipes. Our platform is designed to help you find meaningful connections that last.",
  },
  {
    icon: Shield,
    title: "Safety First",
    description: "Your safety is our priority. From photo verification to in-app safety features, we're committed to creating a secure environment for all users.",
  },
  {
    icon: Users,
    title: "Inclusive Community",
    description: "ISEXY welcomes everyone. We celebrate diversity and are committed to making our platform accessible and welcoming to all.",
  },
  {
    icon: Sparkles,
    title: "Innovation",
    description: "We're constantly evolving with new features like AI-powered matching, video profiles, and more to help you connect in meaningful ways.",
  },
  {
    icon: Lock,
    title: "Privacy & Trust",
    description: "Your data belongs to you. We implement industry-leading security measures and transparent privacy practices to protect your information.",
  },
  {
    icon: Target,
    title: "Quality Over Quantity",
    description: "We focus on helping you find the right match, not just any match. Our algorithms prioritize compatibility and genuine interest.",
  },
];

const features = [
  {
    icon: BadgeCheck,
    title: "Photo Verification",
    description: "Face Check™ technology helps confirm users are real and match their profile photos, reducing catfishing and fake profiles.",
  },
  {
    icon: Globe,
    title: "Passport Mode",
    description: "Connect with people anywhere in the world before you even arrive at your destination. Perfect for travelers and those relocating.",
  },
  {
    icon: Zap,
    title: "Smart Boost",
    description: "Get more visibility when you need it most. Our boost feature puts your profile in front of more potential matches.",
  },
  {
    icon: Star,
    title: "Super Likes",
    description: "Stand out from the crowd and let someone know they're special. Super Likes are 3x more likely to get a match.",
  },
  {
    icon: MessageCircle,
    title: "Icebreakers",
    description: "Don't know what to say? Our AI-powered conversation starters help you make a great first impression.",
  },
  {
    icon: Eye,
    title: "See Who Likes You",
    description: "No more guessing games. Premium members can see everyone who has already liked their profile.",
  },
];

const team = [
  {
    name: "Maria Rodriguez",
    role: "CEO & Co-Founder",
    bio: "Former product lead at a major tech company, Maria founded ISEXY with a vision to create meaningful connections.",
  },
  {
    name: "Carlos Mendez",
    role: "CTO & Co-Founder",
    bio: "With 15+ years in engineering, Carlos leads our technical innovation and ensures platform reliability.",
  },
  {
    name: "Elena Santos",
    role: "Chief Product Officer",
    bio: "Elena brings a decade of UX expertise to create intuitive experiences that make finding love easier.",
  },
  {
    name: "David Chen",
    role: "Head of Safety",
    bio: "Former security specialist, David leads our trust and safety initiatives to protect our community.",
  },
  {
    name: "Sofia Alvarez",
    role: "VP of Marketing",
    bio: "Sofia's creative campaigns have helped millions discover the ISEXY platform worldwide.",
  },
  {
    name: "Miguel Torres",
    role: "Head of AI & Data",
    bio: "Miguel leads our machine learning team, developing algorithms that power our matching technology.",
  },
];

const milestones = [
  { year: "2019", event: "ISEXY founded in Miami with a mission to connect hearts" },
  { year: "2020", event: "Reached 1 million active users worldwide" },
  { year: "2021", event: "Launched Photo Verification and Video Profiles" },
  { year: "2022", event: "Expanded to 50+ countries with localized experiences" },
  { year: "2023", event: "Introduced AI-powered matching algorithms" },
  { year: "2024", event: "Reached 75 million active users globally" },
  { year: "2025", event: "Launched advanced safety features and verification" },
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
          <h1 className="text-xl font-bold text-foreground">About ISEXY</h1>
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
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          Launched to revolutionize how people meet, ISEXY has become the world's most popular app for meeting new people. We're on a mission to bring people together and create meaningful connections that last a lifetime.
        </p>
        <div className="flex justify-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            <span>Miami, FL</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Award className="w-4 h-4 text-primary" />
            <span>Est. 2019</span>
          </div>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="px-4 py-8">
        <div className="bg-gradient-to-br from-primary/20 to-rose-500/20 rounded-3xl p-6 text-center">
          <h3 className="text-xl font-bold text-foreground mb-4">Our Mission</h3>
          <p className="text-foreground/90 leading-relaxed">
            "To create a world where everyone can find love, meaningful connections, and lasting relationships. We believe that technology, when built with empathy and intention, can help people discover their perfect match regardless of geography, background, or circumstance."
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-8">
        <h3 className="text-xl font-bold text-foreground mb-6 text-center">By the Numbers</h3>
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

      {/* Our Story */}
      <div className="px-4 py-8 bg-muted/30">
        <h3 className="text-xl font-bold text-foreground mb-6">Our Story</h3>
        <div className="space-y-4 text-muted-foreground">
          <p>
            ISEXY was born from a simple observation: despite living in an increasingly connected world, many people struggle to find genuine, meaningful relationships. Our founders experienced this firsthand and set out to create a platform that prioritizes quality connections over superficial interactions.
          </p>
          <p>
            Starting from a small team in Miami, we've grown into a global platform serving millions of users across 190+ countries. But our core mission remains unchanged: to help people find love and build lasting relationships.
          </p>
          <p>
            We combine cutting-edge technology with a human-centered approach to dating. Our algorithms don't just look at surface-level compatibility—they analyze shared values, communication styles, and long-term relationship goals to help you find someone truly compatible.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 py-8">
        <h3 className="text-xl font-bold text-foreground mb-6">Our Journey</h3>
        <div className="space-y-4">
          {milestones.map((milestone, index) => (
            <div key={index} className="flex gap-4">
              <div className="w-16 shrink-0">
                <span className="text-sm font-bold text-primary">{milestone.year}</span>
              </div>
              <div className="flex-1 pb-4 border-l-2 border-primary/30 pl-4 relative">
                <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1" />
                <p className="text-sm text-muted-foreground">{milestone.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Our Values */}
      <div className="px-4 py-8 bg-muted/30">
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
      <div className="px-4 py-8">
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

      {/* Leadership Team */}
      <div className="px-4 py-8 bg-muted/30">
        <h3 className="text-xl font-bold text-foreground mb-6">Leadership Team</h3>
        <div className="grid grid-cols-1 gap-4">
          {team.map((member) => (
            <div
              key={member.name}
              className="p-4 bg-card rounded-2xl border border-border"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">{member.name}</h4>
                  <p className="text-sm text-primary">{member.role}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Company Info */}
      <div className="px-4 py-8">
        <h3 className="text-xl font-bold text-foreground mb-6">Company Information</h3>
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Company Name</span>
            <span className="text-foreground font-medium">ISEXY Inc.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Founded</span>
            <span className="text-foreground font-medium">2019</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Headquarters</span>
            <span className="text-foreground font-medium">Miami, Florida, USA</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Employees</span>
            <span className="text-foreground font-medium">500+</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Global Offices</span>
            <span className="text-foreground font-medium">12 Countries</span>
          </div>
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
            Explore real stories from couples who found love on ISEXY.
          </p>
          <button
            onClick={() => navigate("/love-stories")}
            className="px-6 py-3 bg-white text-primary rounded-full font-bold"
          >
            Read Stories
          </button>
        </div>
      </div>

      {/* Contact */}
      <div className="px-4 py-8 bg-muted/30">
        <h3 className="text-xl font-bold text-foreground mb-6">Get in Touch</h3>
        <div className="space-y-4">
          <button
            onClick={() => navigate("/help-support")}
            className="w-full p-4 bg-card rounded-2xl border border-border text-left"
          >
            <h4 className="font-semibold text-foreground">Help & Support</h4>
            <p className="text-sm text-muted-foreground">Questions? We're here to help.</p>
          </button>
          <button
            onClick={() => navigate("/safety")}
            className="w-full p-4 bg-card rounded-2xl border border-border text-left"
          >
            <h4 className="font-semibold text-foreground">Safety Center</h4>
            <p className="text-sm text-muted-foreground">Learn about our safety features.</p>
          </button>
          <button
            onClick={() => navigate("/community-guidelines")}
            className="w-full p-4 bg-card rounded-2xl border border-border text-left"
          >
            <h4 className="font-semibold text-foreground">Community Guidelines</h4>
            <p className="text-sm text-muted-foreground">Our standards for the community.</p>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-8 text-center border-t border-border">
        <p className="text-sm text-muted-foreground mb-4">
          © 2025 ISEXY Inc. All rights reserved.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
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
          <button
            onClick={() => navigate("/cookie-policy")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cookies
          </button>
          <button
            onClick={() => navigate("/licenses")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Licenses
          </button>
        </div>
      </div>
    </div>
  );
}
