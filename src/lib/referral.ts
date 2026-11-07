/**
 * Invite links are https://isexy.ca/?ref=CODE. The code is kept on this
 * device until the new member opens Invite Friends, where it is pre-filled
 * (the server checks it: isexy.apply_referral_code).
 */
const KEY = "isexy_ref_code";
const CODE = /^[A-Z0-9]{4,16}$/;

/** Called once at startup: remember ?ref=CODE from the landing URL. */
export function rememberReferralCode(search: string = window.location.search): void {
  try {
    const code = new URLSearchParams(search).get("ref")?.trim().toUpperCase();
    if (code && CODE.test(code)) localStorage.setItem(KEY, code);
  } catch {
    /* storage blocked: the member can still type the code */
  }
}

export function pendingReferralCode(): string | null {
  try {
    const code = localStorage.getItem(KEY);
    return code && CODE.test(code) ? code : null;
  } catch {
    return null;
  }
}

export function forgetReferralCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function inviteLink(code: string): string {
  return `https://isexy.ca/?ref=${encodeURIComponent(code)}`;
}
