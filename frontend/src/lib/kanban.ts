export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

export const initialData: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    {
      id: "col-progress",
      title: "In Progress",
      cardIds: ["card-4", "card-5"],
    },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      id: "card-3",
      title: "Prototype analytics view",
      details: "Sketch initial dashboard layout and key drill-downs.",
    },
    "card-4": {
      id: "card-4",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
    },
    "card-5": {
      id: "card-5",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-6": {
      id: "card-6",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
    },
    "card-7": {
      id: "card-7",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
    },
    "card-8": {
      id: "card-8",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
    },
  },
};

// An ID names either a column itself or a card inside one.
function findColumn(columns: Column[], id: string): Column | undefined {
  return (
    columns.find((column) => column.id === id) ??
    columns.find((column) => column.cardIds.includes(id))
  );
}

export function moveCard(
  columns: Column[],
  activeId: string,
  overId: string
): Column[] {
  const source = findColumn(columns, activeId);
  const target = findColumn(columns, overId);

  if (!source || !target || activeId === overId || !source.cardIds.includes(activeId)) {
    return columns;
  }

  // Dropping on a column appends; dropping on a card takes that card's place.
  const sourceCardIds = source.cardIds.filter((cardId) => cardId !== activeId);
  const targetCardIds = source === target ? sourceCardIds : [...target.cardIds];
  const position = target.id === overId ? targetCardIds.length : target.cardIds.indexOf(overId);
  targetCardIds.splice(position, 0, activeId);

  return columns.map((column) => {
    if (column === target) {
      return { ...column, cardIds: targetCardIds };
    }
    if (column === source) {
      return { ...column, cardIds: sourceCardIds };
    }
    return column;
  });
}

export function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
}
