import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthButton } from "@/components/AuthButton";
import { Logo } from "@/components/Logo";
import { Link } from "react-router-dom";

const rules = [
  {
    title: "Be yourself.",
    description: "Make sure your photos, age, and bio are true to who you are.",
  },
  {
    title: "Stay safe.",
    description: (
      <>
        Don't be too quick to give out personal information.{" "}
        <Link to="/safety" className="text-primary underline font-semibold">
          Date Safely
        </Link>
      </>
    ),
  },
  {
    title: "Play it cool.",
    description: "Respect others and treat them as you would like to be treated.",
  },
  {
    title: "Be proactive.",
    description: "Always report bad behavior.",
  },
];

export default function HouseRules() {
  const navigate = useNavigate();

  const handleAgree = () => {
    navigate("/profile-setup");
  };

  return (
    <AuthLayout showClose variant="white">
      <div className="flex-1 flex flex-col">
        {/* Logo */}
        <div className="mb-6">
          <Logo size="md" showText={false} variant="dark" />
        </div>

        {/* Header */}
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-extrabold text-foreground">
            Welcome to CubaDate.
          </h1>
          <p className="text-muted-foreground">
            Please follow these House Rules.
          </p>
        </div>

        {/* Rules list */}
        <div className="space-y-6 flex-1">
          {rules.map((rule, index) => (
            <div key={index} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
              <h3 className="font-bold text-lg text-foreground mb-1">
                {rule.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {rule.description}
              </p>
            </div>
          ))}
        </div>

        {/* Agree button */}
        <div className="mt-8">
          <AuthButton variant="primary" onClick={handleAgree}>
            I agree
          </AuthButton>
        </div>
      </div>
    </AuthLayout>
  );
}
