"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { moveCard, type BoardData } from "@/lib/kanban";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ApiError, request } from "@/lib/api";

export const KanbanBoard = ({ onUnauthorized }: { onUnauthorized?: () => void }) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setError("");
    try { setBoard(await request<BoardData>("board")); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized?.();
      setError("Unable to load the board. Please try again.");
    }
  }, [onUnauthorized]);

  useEffect(() => {
    let active = true;
    request<BoardData>("board").then((saved) => { if (active) setBoard(saved); }).catch((failure) => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized?.();
      setError("Unable to load the board. Please try again.");
    });
    return () => { active = false; };
  }, [onUnauthorized]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function mutate(path: string, method: string, body?: unknown): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      setBoard(await request<BoardData>(path, method, body));
      return true;
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized?.();
      setError(failure instanceof ApiError ? failure.message : "Unable to save changes. Please try again.");
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    if (!inFlight.current) setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!board || inFlight.current || !over || active.id === over.id) return;
    const columns = moveCard(board.columns, String(active.id), String(over.id));
    const destination = columns.find((column) => column.cardIds.includes(String(active.id)));
    if (destination) void mutate(`cards/${active.id}/move`, "POST", {
      column_id: destination.id, position: destination.cardIds.indexOf(String(active.id)),
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => mutate(`columns/${columnId}`, "PATCH", { title });
  const handleAddCard = (columnId: string, title: string, details: string) => mutate(`columns/${columnId}/cards`, "POST", { title, details });
  const handleDeleteCard = (_columnId: string, cardId: string) => mutate(`cards/${cardId}`, "DELETE");
  const handleEditCard = (cardId: string, title: string, details: string) => mutate(`cards/${cardId}`, "PATCH", { title, details });

  if (!board) return <div className="p-8">{error ? <><p role="alert">{error}</p><button onClick={load}>Retry</button></> : <p role="status">Loading board...</p>}</div>;
  const activeCard = activeCardId ? board.cards[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                One board. Five columns. Zero clutter.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        {error && <p role="alert" className="text-red-700">{error}</p>}
        {busy && <p role="status">Saving changes...</p>}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveCardId(null)}
        >
          <fieldset disabled={busy} aria-label="Kanban board" className="grid min-w-0 gap-6 border-0 p-0 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                busy={busy}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onEditCard={handleEditCard}
              />
            ))}
          </fieldset>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
