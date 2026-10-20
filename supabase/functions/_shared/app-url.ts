import { isexyEnv } from "./env.ts";

// Stripe return URLs must be controlled by ISEXY, not the client's Origin.
// No redirects can point to an arbitrary website supplied in the request.
export function isexyAppUrl(route: string): string {
  const configured = isexyEnv("APP_URL") || "https://isexy.onrender.com";
  const base = new URL(configured);
  const local = base.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(base.hostname);
  if (base.protocol !== "https:" && !local) {
    throw new Error("ISEXY_APP_URL must be an HTTPS website URL");
  }
  if (base.username || base.password) {
    throw new Error("ISEXY_APP_URL must not include credentials");
  }
  if (!route.startsWith("/") || route.startsWith("//")) {
    throw new Error("Invalid internal ISEXY return path");
  }
  return new URL(route, base).toString();
}
