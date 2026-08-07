"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  startTutorSessionAction,
  type TutorMessageView,
  type TutorSessionView,
} from "@/lib/actions/tutor";
import { AI_CREDIT_COSTS } from "@/lib/constants";

type Props = {
  courseId: string;
  moduleCode: string;
  moduleName: string;
  programmeName: string;
  yearLevel: number;
  initialSession: TutorSessionView | undefined;
  initialBalance: number;
};

function Message({ msg }: { msg: TutorMessageView }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-white"
            : "bg-whiter text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}

export function TutorChat({
  courseId,
  moduleCode,
  moduleName,
  programmeName,
  yearLevel,
  initialSession,
  initialBalance,
}: Props) {
  const cost = AI_CREDIT_COSTS.tutor;

  const [session, setSession] = useState<TutorSessionView | undefined>(
    initialSession,
  );
  const [messages, setMessages] = useState<TutorMessageView[]>(
    initialSession?.messages ?? [],
  );
  const [balance, setBalance] = useState(initialBalance);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startPending, startTransition] = useTransition();

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  function handleStartSession() {
    startTransition(async () => {
      setError(null);
      const result = await startTutorSessionAction({
        courseId,
        moduleCode,
        moduleName,
        programmeName,
        yearLevel,
      });
      if (!result.ok || !result.session) {
        setError(result.error ?? "Could not start session.");
        return;
      }
      setSession(result.session);
      setMessages([]);
      setBalance((b) => b - cost);
    });
  }

  async function handleSend() {
    if (!session || !input.trim() || isStreaming) return;

    const userMsg = input.trim();
    setInput("");
    setError(null);

    const userMsgView: TutorMessageView = {
      role: "user",
      content: userMsg,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsgView]);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(
        `/api/student/tutor/${session.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMsg }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamingContent(accumulated);
      }

      const assistantMsg: TutorMessageView = {
        role: "assistant",
        content: accumulated,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to get a response.",
      );
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!session) {
    return (
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              AI Study Tutor
            </h2>
            <p className="mt-1 text-sm text-body">
              Ask the AI tutor anything about {moduleCode} — concepts,
              exam prep, worked examples.
            </p>
            <p className="mt-2 text-xs text-body">
              A session costs{" "}
              <span className="font-semibold text-foreground">
                {cost} credits
              </span>
              . Your balance:{" "}
              <span
                className={`font-semibold ${balance >= cost ? "text-meta-3" : "text-meta-1"}`}
              >
                {balance}
              </span>
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-meta-1">{error}</p>
        )}

        <div className="mt-4">
          {balance >= cost ? (
            <button
              onClick={handleStartSession}
              disabled={startPending}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
            >
              {startPending
                ? "Starting…"
                : `Start session · ${cost} credits`}
            </button>
          ) : (
            <p className="text-sm font-medium text-meta-1">
              Not enough credits. Ask your admin to top up your account.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stroke bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stroke px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            AI Study Tutor
          </h2>
          <p className="text-xs text-body">
            {moduleCode} · session started today
          </p>
        </div>
        <button
          onClick={handleStartSession}
          disabled={startPending || balance < cost}
          title={`New session (${cost} credits)`}
          className="text-xs font-medium text-body hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          New session
        </button>
      </div>

      <div className="flex h-96 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && !streamingContent && (
          <p className="text-center text-sm text-body">
            Ask me anything about {moduleName}.
          </p>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl bg-whiter px-4 py-2.5 text-sm leading-relaxed text-foreground">
              <p className="whitespace-pre-wrap">{streamingContent}</p>
              <span className="mt-1 inline-block h-3 w-1 animate-pulse bg-primary" />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-whiter px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-body"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="border-t border-stroke px-4 py-2 text-xs text-meta-1">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-stroke p-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={isStreaming}
          className="flex-1 resize-none rounded-xl border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-whiter"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="flex-shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
