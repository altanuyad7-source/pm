import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { useState, type FormEvent } from "react";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  busy: boolean;
  onDelete: (cardId: string) => Promise<boolean>;
  onEdit: (cardId: string, title: string, details: string) => Promise<boolean>;
};

export function KanbanCard({ card, onDelete, onEdit, busy }: KanbanCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: busy || editing });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim() && await onEdit(card.id, title.trim(), details.trim())) setEditing(false);
  }

  function startEditing() {
    setTitle(card.title);
    setDetails(card.details);
    setEditing(true);
  }

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      onPointerDown={(event) => listeners?.onPointerDown?.(event)}
      data-testid={`card-${card.id}`}
    >
      {editing ? (
        <form aria-label="Edit card" className="space-y-3" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
          <label className="block text-sm">Card title<input autoFocus required className="mt-1 w-full rounded border p-2" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="block text-sm">Details<textarea className="mt-1 w-full rounded border p-2" value={details} onChange={(event) => setDetails(event.target.value)} /></label>
          <button className="rounded bg-[var(--secondary-purple)] px-3 py-1 text-white" type="submit">Save card</button>
          <button className="ml-3" type="button" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
              {card.title}
            </h4>
            <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
              {card.details}
            </p>
          </div>
          <div onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Move ${card.title}`} className="px-2 py-1 text-xs font-semibold text-[var(--gray-text)]">Move</button>
            <button type="button" aria-label={`Edit ${card.title}`} className="px-2 py-1 text-xs font-semibold text-[var(--primary-blue)]" onClick={startEditing}>Edit</button>
            <button
              type="button"
              onKeyDown={(event) => event.stopPropagation()}
              onClick={() => onDelete(card.id)}
              className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
              aria-label={`Delete ${card.title}`}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
