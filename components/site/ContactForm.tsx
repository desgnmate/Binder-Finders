"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { CONTACT_TOPICS, type ContactInput, type ContactResult, type ContactTopic } from "../../lib/contact";
import { box, btnDark, headline, input } from "./ui";

type Send = (raw: Record<string, string>) => Promise<ContactResult>;

export function ContactForm({
  send,
  initialTopic = "card",
  initialReference = "",
  fallbackEmail,
}: {
  send: Send;
  initialTopic?: ContactTopic;
  initialReference?: string;
  fallbackEmail: string;
}) {
  const [topic, setTopic] = useState<ContactTopic>(initialTopic);
  const [result, setResult] = useState<ContactResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldError = (key: keyof ContactInput) =>
    result && !result.ok ? result.fieldErrors?.[key] : undefined;

  if (result?.ok) {
    return (
      <div className={`${box} flex min-w-0 flex-[1_1_520px] flex-col items-start gap-4 rounded-[28px] p-7`} role="status">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-ink-black bg-[#9fdc8a]">
          <Check size={22} aria-hidden="true" />
        </span>
        <h2 className={`${headline} m-0 text-[26px]`}>Message sent</h2>
        <p className="m-0 text-[17px] leading-relaxed">Thanks! We&apos;ll reply to the email you gave us.</p>
      </div>
    );
  }

  return (
    <form
      data-motion="rise"
      aria-labelledby="contact-form-title"
      noValidate
      className={`${box} relative flex min-w-0 flex-[1_1_520px] flex-col gap-[18px] overflow-hidden rounded-[28px] p-6 md:p-7`}
      onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
        startTransition(async () => {
          try {
            setResult(await send({ ...data, topic }));
          } catch {
            setResult({ ok: false, error: `Your message couldn't be sent. Email us at ${fallbackEmail} instead.` });
          }
        });
      }}
    >
      <h2 id="contact-form-title" className={`${headline} m-0 text-[26px]`}>Send a message</h2>
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2 p-0 text-[15px] font-semibold">What&apos;s it about?</legend>
        <div className="flex flex-wrap gap-2.5">
          {CONTACT_TOPICS.map((t) => (
            <label
              key={t.value}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[3px] border-ink-black bg-white px-4 text-[15px] font-semibold has-[:checked]:bg-brand-yellow has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-blue/40"
            >
              <input
                type="radio"
                name="topic-choice"
                value={t.value}
                checked={topic === t.value}
                onChange={() => setTopic(t.value)}
                className="m-0 h-[18px] w-[18px] accent-ink-black"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3.5">
        <Field label="Name" error={fieldError("name")} className="flex-[1_1_220px]">
          <input name="name" type="text" autoComplete="name" required maxLength={120} className={input} />
        </Field>
        <Field label="Email" error={fieldError("email")} className="flex-[1_1_220px]">
          <input name="email" type="email" autoComplete="email" required maxLength={200} className={input} />
        </Field>
      </div>
      <Field label="Card or request number" hint="Optional" error={fieldError("reference")}>
        <input
          name="reference"
          type="text"
          maxLength={200}
          defaultValue={initialReference}
          placeholder="e.g. Charizard Base Set 4/102, or your request number"
          className={input}
        />
      </Field>
      <Field label="Message" error={fieldError("message")}>
        <textarea name="message" required minLength={10} maxLength={4000} rows={6} className={`${input} min-h-[140px] resize-y py-3`} />
      </Field>
      <div aria-hidden="true" className="absolute -left-[10000px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {result && !result.ok && (
        <p role="alert" className="m-0 rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-[15px] text-red-800">
          {result.error}
          {!result.fieldErrors && (
            <>
              {" "}
              <a href={`mailto:${fallbackEmail}`} className="font-semibold underline">{fallbackEmail}</a>
            </>
          )}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${btnDark} min-h-[52px] self-start !px-7 text-[17px]`}>
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <label className={`flex flex-col gap-1.5 text-[15px] font-semibold ${className}`}>
      <span>
        {label} {hint && <span className="text-[13px] font-normal">{hint}</span>}
      </span>
      {children}
      {error && <span className="text-sm font-medium text-red-700">{error}</span>}
    </label>
  );
}
