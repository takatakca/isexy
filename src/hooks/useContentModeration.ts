import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Patterns to detect personal information
const PHONE_PATTERNS = [
  /\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, // International format
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, // US/Canada format
  /\d{8,}/g, // Long number sequences
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SOCIAL_MEDIA_PATTERNS = [
  /@[a-zA-Z0-9_]+/g, // @username mentions
  /(?:instagram|ig|insta|facebook|fb|whatsapp|wa|telegram|tg|snapchat|snap|twitter|x)[\s:@]*[a-zA-Z0-9._-]+/gi,
  /(?:mi\s*)?(?:instagram|facebook|whatsapp|telegram)(?:\s*es)?[\s:]+[a-zA-Z0-9._@-]+/gi, // Spanish versions
];

const ADDRESS_PATTERNS = [
  /\d+\s+[a-zA-Z]+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct)/gi,
  /calle\s+[a-zA-Z0-9\s]+(?:,|\s+)?\s*(?:no\.?|#|numero)?\s*\d+/gi, // Spanish addresses
];

interface ModerationResult {
  isClean: boolean;
  violations: {
    type: 'phone_number' | 'email' | 'address' | 'social_media' | 'payment_info' | 'other';
    content: string;
  }[];
  sanitizedContent: string;
}

export function useContentModeration() {
  const checkContent = (content: string): ModerationResult => {
    const violations: ModerationResult['violations'] = [];
    let sanitizedContent = content;

    // Check for phone numbers
    for (const pattern of PHONE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          if (match.length >= 8) { // Ignore short number sequences
            violations.push({ type: 'phone_number', content: match });
            sanitizedContent = sanitizedContent.replace(match, '[HIDDEN]');
          }
        });
      }
    }

    // Check for emails
    const emailMatches = content.match(EMAIL_PATTERN);
    if (emailMatches) {
      emailMatches.forEach((match) => {
        violations.push({ type: 'email', content: match });
        sanitizedContent = sanitizedContent.replace(match, '[HIDDEN]');
      });
    }

    // Check for social media handles
    for (const pattern of SOCIAL_MEDIA_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          violations.push({ type: 'social_media', content: match });
          sanitizedContent = sanitizedContent.replace(match, '[HIDDEN]');
        });
      }
    }

    // Check for addresses
    for (const pattern of ADDRESS_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          violations.push({ type: 'address', content: match });
          sanitizedContent = sanitizedContent.replace(match, '[HIDDEN]');
        });
      }
    }

    return {
      isClean: violations.length === 0,
      violations,
      sanitizedContent,
    };
  };

  const reportViolation = async (
    profileId: string,
    messageId: string | null,
    violations: ModerationResult['violations']
  ) => {
    try {
      // Record violations
      for (const violation of violations) {
        await supabase.from("content_violations").insert({
          profile_id: profileId,
          message_id: messageId,
          violation_type: violation.type,
          detected_content: violation.content,
          action_taken: "warning_issued",
        });
      }

      // Check existing warnings
      const { data: existingWarnings } = await supabase
        .from("user_warnings")
        .select("*")
        .eq("profile_id", profileId)
        .eq("warning_type", "contact_sharing")
        .order("created_at", { ascending: false });

      const warningCount = (existingWarnings?.length || 0) + 1;

      let banUntil: Date | null = null;
      let isPermanent = false;

      // Apply progressive bans
      if (warningCount === 1) {
        banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        toast.warning("⚠️ Warning: Sharing personal information is not allowed. 24-hour restriction applied.");
      } else if (warningCount === 2) {
        banUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        toast.error("⚠️ Second warning: 7-day messaging restriction applied.");
      } else if (warningCount >= 3) {
        isPermanent = true;
        toast.error("⚠️ Account permanently banned for repeated violations.");
      }

      // Create warning record
      await supabase.from("user_warnings").insert({
        profile_id: profileId,
        warning_type: "contact_sharing",
        warning_level: Math.min(warningCount, 3),
        ban_until: banUntil?.toISOString(),
        is_permanent_ban: isPermanent,
        evidence: JSON.stringify(violations),
      });

      return { warningCount, banUntil, isPermanent };
    } catch (error) {
      console.error("Failed to report violation:", error);
      return null;
    }
  };

  const checkUserBanStatus = async (profileId: string): Promise<{
    isBanned: boolean;
    banUntil?: Date;
    isPermanent?: boolean;
  }> => {
    try {
      const { data } = await supabase
        .from("user_warnings")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return { isBanned: false };

      if (data.is_permanent_ban) {
        return { isBanned: true, isPermanent: true };
      }

      if (data.ban_until) {
        const banUntil = new Date(data.ban_until);
        if (banUntil > new Date()) {
          return { isBanned: true, banUntil };
        }
      }

      return { isBanned: false };
    } catch (error) {
      console.error("Failed to check ban status:", error);
      return { isBanned: false };
    }
  };

  return {
    checkContent,
    reportViolation,
    checkUserBanStatus,
  };
}
