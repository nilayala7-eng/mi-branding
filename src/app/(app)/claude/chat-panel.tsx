"use client";

import { useRef, useState } from "react";
import { ArrowUp, Database, LoaderCircle } from "lucide-react";
import clsx from "clsx";

interface ToolTrace {
  name: string;
  input: unknown;
  ok: boolean;
  error?: string;
}
interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolTrace[];
  error?: boolean;
}

const EXAMPLES = [
  "Analiza mis últimos 30 días.",
  "¿Qué contenido funciona mejor?",
  "¿Qué tienen en común mis mejores Reels?",
  "¿Qué contenido genera más seguidores?",
  "¿Qué contenido genera views pero pocos seguidores?",
  "¿Qué debería probar esta semana?",
  "Compara este mes con el anterior.",
  "Encuentra patrones que no sean obvios.",
];

/** Minimal, safe markdown: **bold**, headings, bullet lists. No HTML injection. */
function RichText({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  return (
    <div className="space-y-2 text-[14px] leading-relaxed text-ink-soft">
      {text.split(/\n{2,}/).map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        const h = block.match(/^#{1,4}\s+(.*)$/);
        if (h && lines.length === 1) {
          return (
            <h3 key={bi} className="pt-1 font-display text-[15px] font-semibold text-ink">
              {h[1]}
            </h3>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

export function ChatPanel({ configured, isMock }: { configured: boolean; isMock: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const history: Message[] = [...messages.filter((m) => !m.error), { role: "user", content }];
    setMessages((m) => [...m, { role: "user", content }]);
    setDraft("");
    setPending(true);
    try {
      const res = await fetch("/api/claude/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setMessages((m) => [...m, { role: "assistant", content: data.text || "(sin respuesta)", toolCalls: data.toolCalls }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Error", error: true }]);
    } finally {
      setPending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-220px)] flex-col">
      {!configured && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/[0.06] p-4 text-sm text-ink-soft">
          <strong className="text-ink">Claude no está configurado.</strong> Añade <code className="text-ink">ANTHROPIC_API_KEY</code> en{" "}
          <code className="text-ink">.env.local</code> y reinicia la app. Instrucciones en CLAUDE_SETUP.md.
        </div>
      )}
      {isMock && configured && (
        <div className="mb-4 text-xs text-ink-muted">
          Claude está leyendo datos de demostración: sus respuestas sirven para probar el flujo, no describen tu cuenta.
        </div>
      )}

      <div className="flex-1 space-y-5">
        {messages.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((q) => (
              <button
                key={q}
                type="button"
                disabled={!configured}
                onClick={() => send(q)}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-ink-soft transition-colors hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-sm text-ink">{m.content}</div>
            </div>
          ) : (
            <div key={i} className={clsx("max-w-3xl", m.error && "text-critical")}>
              {m.error ? <p className="text-sm">{m.content}</p> : <RichText text={m.content} />}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <details className="mt-3 text-xs text-ink-muted">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 hover:text-ink-soft">
                    <Database size={12} /> Datos consultados ({m.toolCalls.length})
                  </summary>
                  <ul className="mt-2 space-y-1 border-l border-border pl-3 font-mono text-[11px]">
                    {m.toolCalls.map((t, ti) => (
                      <li key={ti} className={t.ok ? undefined : "text-critical"}>
                        {t.name}({JSON.stringify(t.input)}){t.error ? ` → ${t.error}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ),
        )}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle size={14} className="animate-spin" /> Consultando datos y analizando…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 mt-6 bg-bg pb-2 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-border-strong bg-surface p-2 focus-within:border-ink-muted">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            maxLength={8000}
            disabled={!configured}
            placeholder={configured ? "Pregunta sobre tus datos…" : "Configura ANTHROPIC_API_KEY para empezar"}
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={!configured || pending || !draft.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-bg disabled:opacity-40"
          >
            <ArrowUp size={16} strokeWidth={2.25} />
          </button>
        </div>
      </form>
    </div>
  );
}
