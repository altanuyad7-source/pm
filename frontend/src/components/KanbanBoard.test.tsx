import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";
import { ApiError, request } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(), request: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue(structuredClone(initialData));
});

async function renderBoard() {
  render(<KanbanBoard />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
  return screen.getAllByTestId(/column-/i)[0];
}

it("loads the saved five-column board", async () => {
  await renderBoard();
  expect(request).toHaveBeenCalledWith("board");
  expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
});

it("saves a renamed column on Enter", async () => {
  const column = await renderBoard();
  const saved = structuredClone(initialData);
  saved.columns[0].title = "New Name";
  vi.mocked(request).mockResolvedValueOnce(saved);
  const input = within(column).getByLabelText("Column title");
  await userEvent.clear(input);
  await userEvent.type(input, "New Name{Enter}");
  expect(request).toHaveBeenCalledWith("columns/col-backlog", "PATCH", { title: "New Name" });
  expect(await within(column).findByDisplayValue("New Name")).toBeInTheDocument();
});

it("keeps new-card input after a failed save", async () => {
  const column = await renderBoard();
  vi.mocked(request).mockRejectedValueOnce(new Error("Offline"));
  await userEvent.click(within(column).getByRole("button", { name: "Add a card" }));
  await userEvent.type(within(column).getByLabelText("Card title"), "Draft");
  await userEvent.click(within(column).getByRole("button", { name: "Add card" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save");
  expect(within(column).getByLabelText("Card title")).toHaveValue("Draft");
  expect(within(column).queryByRole("heading", { name: "Draft" })).not.toBeInTheDocument();
});

it("edits card title and details using the saved API response", async () => {
  await renderBoard();
  const saved = structuredClone(initialData);
  saved.cards["card-1"] = { id: "card-1", title: "Edited", details: "Updated notes" };
  vi.mocked(request).mockResolvedValueOnce(saved);
  await userEvent.click(screen.getByRole("button", { name: "Edit Align roadmap themes" }));
  const form = screen.getByRole("form", { name: "Edit card" });
  await userEvent.clear(within(form).getByLabelText("Card title"));
  await userEvent.type(within(form).getByLabelText("Card title"), "Edited");
  await userEvent.clear(within(form).getByLabelText("Details"));
  await userEvent.type(within(form).getByLabelText("Details"), "Updated notes");
  await userEvent.click(within(form).getByRole("button", { name: "Save card" }));
  expect(await screen.findByRole("heading", { name: "Edited" })).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("cards/card-1", "PATCH", { title: "Edited", details: "Updated notes" });
});

it("keeps a card when deletion fails and restores failed column renaming", async () => {
  const column = await renderBoard();
  vi.mocked(request).mockRejectedValue(new Error("Offline"));
  await userEvent.click(screen.getByRole("button", { name: "Delete Align roadmap themes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save");
  expect(screen.getByRole("heading", { name: "Align roadmap themes" })).toBeInTheDocument();
  const input = within(column).getByLabelText("Column title");
  await userEvent.clear(input);
  await userEvent.type(input, "Unsaved{Enter}");
  expect(await within(column).findByDisplayValue("Backlog")).toBeInTheDocument();
});

it("offers retry after a failed load", async () => {
  vi.mocked(request).mockRejectedValueOnce(new Error("Offline"));
  render(<KanbanBoard />);
  await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
});

it("reports an expired session to the login shell", async () => {
  const expired = vi.fn();
  vi.mocked(request).mockRejectedValueOnce(new ApiError(401, "Expired"));
  render(<KanbanBoard onUnauthorized={expired} />);
  await screen.findByRole("alert");
  expect(expired).toHaveBeenCalledOnce();
});
