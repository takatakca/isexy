import { Logo } from "@/components/Logo";
import { AuthButton } from "@/components/AuthButton";
import { useNavigate, Link } from "react-router-dom";

// Social icons as inline SVGs
const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FacebookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="gradient-primary min-h-screen flex flex-col">
      {/* Logo section */}
      <div className="flex-1 flex items-center justify-center pt-16 pb-8">
        <Logo size="xl" variant="light" />
      </div>

      {/* Auth section */}
      <div className="px-6 pb-10 space-y-6 animate-slide-up">
        {/* Terms text */}
        <p className="text-center text-primary-foreground/90 text-sm leading-relaxed">
          By tapping 'Continue' you agree to our{" "}
          <Link to="/terms" className="underline font-semibold hover:opacity-80">
            Terms
          </Link>
          .<br />
          Learn how we process your data in our{" "}
          <Link to="/privacy" className="underline font-semibold hover:opacity-80">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/cookies" className="underline font-semibold hover:opacity-80">
            Cookies Policy
          </Link>
          .
        </p>

        {/* Auth buttons */}
        <div className="space-y-3">
          <AuthButton
            icon={<GoogleIcon />}
            onClick={() => navigate("/auth")}
          >
            Continue with Google
          </AuthButton>

          <AuthButton
            icon={<FacebookIcon />}
            onClick={() => navigate("/auth")}
          >
            Continue with Facebook
          </AuthButton>

          <AuthButton
            icon={<PhoneIcon />}
            onClick={() => navigate("/auth")}
          >
            Continue with Phone Number
          </AuthButton>
        </div>

        {/* Cuban signup option */}
        <div className="mt-4 p-4 bg-white/10 rounded-xl border border-white/20">
          <p className="text-primary-foreground/90 text-sm mb-3 text-center">
            🇨🇺 Are you from Cuba? Sign up for FREE with verification!
          </p>
          <button
            onClick={() => navigate("/cuban-signup")}
            className="w-full py-3 px-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors"
          >
            Cuban Registration (Free)
          </button>
        </div>

        {/* Trouble signing in */}
        <button className="w-full text-center text-primary-foreground font-semibold py-2 hover:opacity-80 transition-opacity mt-4">
          Trouble signing in?
        </button>
      </div>
    </div>
  );
}
