// Claude (Anthropic API) for ISEXY's AI concierge and message translation.
// Replaces the Lovable AI gateway. Key: ISEXY_ANTHROPIC_API_KEY (function secret).
import Anthropic from "npm:@anthropic-ai/sdk@0.132.1";
import { isexyEnv } from "./env.ts";

export const CLAUDE_MODEL = isexyEnv("AI_CHAT_MODEL") ?? "claude-opus-5-5";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function claudeClient(): Anthropic | null {
  const apiKey = isexyEnv("ANTHROPIC_API_KEY");
  return apiKey ? new Anthropic({ apiKey }) : null;
}

// Server-side refusal fallback: if the model declines, the API re-runs the
// request on a fallback model inside the same call.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as const;

/**
 * Streams a reply as OpenAI-style SSE (`data: {"choices":[{"delta":{"content":"…"}}]}`
 * then `data: [DONE]`), the format the ISEXY chat widget already reads.
 */
export function streamChatAsSse(
  client: Anthropic,
  opts: { system: string; messages: ChatTurn[]; maxTokens?: number; emptyReply?: string },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, text: string) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      try {
        const stream = client.beta.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: opts.maxTokens ?? 16000,
          system: opts.system,
          messages: opts.messages,
          output_config: { effort: "low" },
          ...FALLBACK,
          // deno-lint-ignore no-explicit-any
        } as any);
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
            send(controller, event.delta.text);
            wrote = true;
          }
        }
      } catch (error) {
        console.error("Claude stream error:", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
      }
      if (!wrote) send(controller, opts.emptyReply ?? "Sorry, I can't answer that right now. Please try again in a moment.");
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

/** One short completion (e.g. a translation). Returns null when Claude gives no text. */
export async function completeText(
  client: Anthropic,
  opts: { system: string; prompt: string; maxTokens?: number },
): Promise<string | null> {
  const response = await client.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { effort: "low" },
    ...FALLBACK,
    // deno-lint-ignore no-explicit-any
  } as any);
  if (response.stop_reason === "refusal") return null;
  const text = response.content
    // deno-lint-ignore no-explicit-any
    .filter((b: any) => b.type === "text")
    // deno-lint-ignore no-explicit-any
    .map((b: any) => b.text)
    .join("")
    .trim();
  return text || null;
}
