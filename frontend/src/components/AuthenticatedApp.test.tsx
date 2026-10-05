import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AuthenticatedApp } from "./AuthenticatedApp";

vi.mock("./KanbanBoard", () => ({ KanbanBoard: () => <h1>Kanban Studio</h1> }));

afterEach(() => vi.unstubAllGlobals());

it("signs in and out through the API", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401 })
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  render(<AuthenticatedApp />);
  await screen.findByRole("heading", { name: "Sign in" });
  await userEvent.type(screen.getByLabelText("Username"), "user");
  await userEvent.type(screen.getByLabelText("Password"), "password");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("heading", { name: "Kanban Studio" });
  expect(fetchMock).toHaveBeenCalledWith("/api/login", expect.objectContaining({ body: JSON.stringify({ username: "user", password: "password" }) }));
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("heading", { name: "Sign in" });
});

it("keeps the board hidden after invalid credentials", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
  render(<AuthenticatedApp />);
  await screen.findByRole("heading", { name: "Sign in" });
  await userEvent.type(screen.getByLabelText("Username"), "user");
  await userEvent.type(screen.getByLabelText("Password"), "wrong");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
  expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
});
