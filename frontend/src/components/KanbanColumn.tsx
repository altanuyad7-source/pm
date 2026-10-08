import clsx from "clsx";
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  busy: boolean;
  onRename: (columnId: string, title: string) => Promise<boolean>;
  onAddCard: (columnId: string, title: string, details: string) => Promise<boolean>;
  onDeleteCard: (cardId: string) => Promise<boolean>;
  onEditCard: (cardId: string, title: string, details: string) => Promise<boolean>;
};

export function KanbanColumn({
  column,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
  onEditCard,
  busy,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: busy });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[520px] flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)] transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-full">
          <div className="flex items-center gap-3">
            <div className="h-2 w-10 rounded-full bg-[var(--accent-yellow)]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              {cards.length} cards
            </span>
          </div>
          <ColumnTitle key={column.title} title={column.title} onSave={(title) => onRename(column.id, title)} />
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-3">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              busy={busy}
              onDelete={onDeleteCard}
              onEdit={onEditCard}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      <NewCardForm onAdd={(title, details) => onAddCard(column.id, title, details)} />
    </section>
  );
}

function ColumnTitle({ title, onSave }: { title: string; onSave: (title: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(title);
  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === title) { setDraft(title); return; }
    if (!await onSave(trimmed)) setDraft(title);
  }
  return <input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={save}
    onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === "Escape") setDraft(title);
    }}
    className="mt-3 w-full bg-transparent font-display text-lg font-semibold text-[var(--navy-dark)] outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
    aria-label="Column title" />;
}
