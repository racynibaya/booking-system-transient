"use client";

import { CheckCircle2, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { createInquiry } from "@/app/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { IconChip } from "@/components/ui/icon-chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// M2 — the public entry point. A guest with no account asks the operator a question; it opens a
// thread in the operator's Inbox. (The tokenized reply page + email nudge land in M2b.)
export function AskQuestion({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const res = await createInquiry({
        slug,
        guestName: name,
        guestEmail: email,
        guestPhone: phone || undefined,
        message,
      });
      if (res.ok) setSent(true);
      else setError(res.error);
    });
  };

  if (sent) {
    return (
      <Card elevation={1} className="flex items-center gap-3 p-5">
        <IconChip icon={CheckCircle2} tone="success" />
        <div>
          <p className="text-title-sm text-ink">Question sent</p>
          <p className="text-body-sm text-muted">
            The host will get back to you at {email}. Thanks!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <IconChip icon={MessageCircle} tone="sea" />
        <div>
          <h2 className="text-display-sm text-ink">Have a question?</h2>
          <p className="text-body-sm text-muted">
            Ask the host directly — they&rsquo;ll reply by email.
          </p>
        </div>
      </div>

      {open ? (
        <Card elevation={1} className="p-5">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </Field>
              <Field label="Email">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  inputMode="email"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Mobile number (optional)">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0917 123 4567"
                    inputMode="tel"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Your question">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Is the room available on…? Is parking included?"
                    rows={4}
                  />
                </Field>
              </div>
            </div>

            {error && <p className="text-body-sm text-error">{error}</p>}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={pending || !name.trim() || !email.trim() || !message.trim()}
              >
                {pending ? "Sending…" : "Send question"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div>
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            <MessageCircle className="size-4" /> Ask a question
          </Button>
        </div>
      )}
    </section>
  );
}
