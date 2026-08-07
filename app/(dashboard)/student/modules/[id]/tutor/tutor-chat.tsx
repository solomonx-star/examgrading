"use client";

import { useRef, useState, useEffect } from "react";
import { MarkdownContent } from "@/components/ui/MarkdownContent";

type Message = { role: "user" | "assistant"; content: string };

export function TutorChat({
  courseId,
  initialMessages,
  initialBalance,
}: {
  courseId: string;
  initialMessages: Message[];
  initialBalance: number;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [balance, setBalance] = useState(initialBalance);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || streaming || balance < 1) return;

    setError(null);
    setInput("");
    setBalance((b) => b - 1);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);

    // Append placeholder for the assistant reply
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/student/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, message: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? "Could not reach tutor.";
        setError(msg);
        // Restore balance if credit check failed
        if (res.status === 402) setBalance((b) => b + 1);
        setMessages((prev) => prev.slice(0, -2)); // remove user + empty assistant
        return;
      }

      if (!res.body) throw new Error("No response body.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content: last.content + chunk,
              };
            }
            return next;
          });
        }
      }
    } catch {
      setError("Connection error. Please try again.");
      setMessages((prev) => prev.slice(0, -2));
      setBalance((b) => b + 1);
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const canSend = balance >= 1 && !streaming && input.trim().length > 0;

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[400px] flex-col rounded-2xl border border-stroke bg-white shadow-sm">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              🎓
            </div>
            <p className="text-sm font-medium text-foreground">
              Your AI Tutor is ready
            </p>
            <p className="mt-1 text-xs text-body">
              Ask any question about this module and I&apos;ll help you understand.
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm">
                  🎓
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-white"
                    : "bg-whiter text-foreground"
                }`}
              >
                {m.role === "assistant" ? (
                  m.content ? (
                    <MarkdownContent content={m.content} />
                  ) : (
                    <span className="inline-flex gap-1 text-body">
                      <span className="animate-bounce">·</span>
                      <span className="animate-bounce [animation-delay:0.15s]">·</span>
                      <span className="animate-bounce [animation-delay:0.3s]">·</span>
                    </span>
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error ? (
        <div className="border-t border-stroke bg-meta-1/5 px-4 py-2 text-xs text-meta-1">
          {error}
        </div>
      ) : null}

      {/* Input */}
      <div className="border-t border-stroke p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                balance < 1
                  ? "No credits — top up to continue"
                  : "Ask your tutor anything… (Enter to send)"
              }
              disabled={streaming || balance < 1}
              className="block w-full resize-none rounded-xl border border-stroke bg-whiter px-3 py-2.5 text-sm text-foreground placeholder-body shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              style={{ maxHeight: "120px", overflowY: "auto" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${t.scrollHeight}px`;
              }}
            />
          </div>
          <button
            onClick={send}
            disabled={!canSend}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 rotate-90"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-body">1 credit per message</p>
          <p className={`text-xs font-medium ${balance < 3 ? "text-meta-1" : "text-body"}`}>
            {balance} credit{balance === 1 ? "" : "s"} remaining
            {balance < 1 ? " — " : null}
            {balance < 1 ? (
              <a href="/student/credits" className="underline">
                top up
              </a>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
