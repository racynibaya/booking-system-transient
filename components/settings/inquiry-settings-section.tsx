"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTemplate, setAutoReply, upsertTemplate } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Template = { id: string; title: string; body: string };

const PLACEHOLDER = "Thanks for your question! The host usually replies within a few hours.";

function AutoReplyCard({ autoReply }: { autoReply: { enabled: boolean; text: string } }) {
  const [enabled, setEnabled] = useState(autoReply.enabled);
  const [text, setText] = useState(autoReply.text);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await setAutoReply(enabled, text);
      if (res.ok) toast.success("Auto-reply saved");
      else toast.error(res.error);
    });

  return (
    <Card elevation={1} className="flex flex-col gap-4 p-4 md:p-5">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1 size-4 accent-[var(--color-primary)]"
        />
        <span>
          <span className="block text-title-sm text-ink">Auto-reply to new questions</span>
          <span className="block text-body-sm text-muted">
            The moment a guest asks, send an instant acknowledgement so they&rsquo;re never left
            waiting. You still get the question in your Inbox to answer.
          </span>
        </span>
      </label>

      <Field label="Auto-reply message">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={3}
          disabled={!enabled}
        />
      </Field>

      <div>
        <Button type="button" size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save auto-reply"}
        </Button>
      </div>
    </Card>
  );
}

function TemplateForm({ template, onDone }: { template?: Template; onDone: () => void }) {
  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await upsertTemplate({ id: template?.id, title, body });
      if (res.ok) {
        toast.success(template ? "Reply updated" : "Reply saved");
        onDone();
      } else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-3">
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Parking & check-in"
        />
      </Field>
      <Field label="Message">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Yes, parking is free. Check-in is from 2pm…"
          rows={3}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : template ? "Save changes" : "Add reply"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function InquirySettingsSection({
  autoReply,
  templates,
}: {
  autoReply: { enabled: boolean; text: string };
  templates: Template[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteTemplate(id);
      setRemoveId(null);
      if (res.ok) toast.success("Reply removed");
      else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-4">
      <AutoReplyCard autoReply={autoReply} />

      <div className="flex flex-col gap-1">
        <h3 className="text-title-md text-ink">Saved replies</h3>
        <p className="text-body-sm text-muted">
          Canned answers you can drop into the Inbox in two taps, then tweak before sending.
        </p>
      </div>

      {templates.length === 0 && !adding && (
        <p className="text-body-sm text-muted">No saved replies yet.</p>
      )}

      {templates.map((t) => (
        <Card key={t.id} elevation={1} className="p-4 md:p-5">
          {editingId === t.id ? (
            <TemplateForm template={t} onDone={() => setEditingId(null)} />
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-title-sm text-ink">{t.title}</p>
                <p className="mt-0.5 line-clamp-2 text-body-sm text-muted">{t.body}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditingId(t.id)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoveId(t.id)}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {adding ? (
        <Card elevation={1} className="p-4 md:p-5">
          <TemplateForm onDone={() => setAdding(false)} />
        </Card>
      ) : (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add a saved reply
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={removeId !== null}
        title="Remove this saved reply?"
        description="This only removes the template — it won't affect any sent messages."
        confirmLabel="Remove"
        pending={pending}
        onCancel={() => setRemoveId(null)}
        onConfirm={() => removeId && remove(removeId)}
      />
    </div>
  );
}
