/** Turn raw Supabase Auth errors into clear, human copy. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Try again or reset your password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox (and spam folder).";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Sign in instead.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password should be") || m.includes("weak password")) return "Choose a stronger password (at least 8 characters, mixing letters and numbers).";
  if (m.includes("network") || m.includes("failed to fetch")) return "Can't reach the server. Check your connection and try again.";
  return message;
}
