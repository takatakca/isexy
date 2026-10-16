import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ContactMethodModal } from "@/components/ContactMethodModal";

interface ChatTarget {
  matchId: string;
  otherName: string;
  otherPhotoUrl?: string;
  /** Already unlocked (get_my_conversations.is_unlocked). */
  unlocked?: boolean;
}

/**
 * "Chat now" after a match, the same way everywhere: members whose chat is
 * already open (Premium, or this conversation unlocked) go straight to the
 * chat; everyone else picks chat / video / phone in ContactMethodModal,
 * which unlocks the conversation server-side first.
 * Render `contactModal` once in the page.
 */
export function useChatOpener(options?: { onClose?: () => void }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [target, setTarget] = useState<ChatTarget | null>(null);

  const openChat = useCallback((t: ChatTarget) => {
    if (t.unlocked || profile?.is_premium) navigate(`/chat/${t.matchId}`);
    else setTarget(t);
  }, [navigate, profile?.is_premium]);

  const contactModal = target ? (
    <ContactMethodModal
      isOpen
      onClose={() => { setTarget(null); options?.onClose?.(); }}
      matchId={target.matchId}
      otherName={target.otherName}
      otherPhotoUrl={target.otherPhotoUrl}
    />
  ) : null;

  return { openChat, contactModal, contactOpen: !!target };
}
