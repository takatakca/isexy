/** Open the AI concierge popup from anywhere (e.g. Help Center "Ask AI"). */
export const OPEN_ASSISTANT_EVENT = "isexy:open-assistant";

export interface OpenAssistantDetail {
  /** Optional question to send immediately. */
  query?: string;
}

export function openAssistant(query?: string) {
  window.dispatchEvent(
    new CustomEvent<OpenAssistantDetail>(OPEN_ASSISTANT_EVENT, { detail: { query } }),
  );
}
