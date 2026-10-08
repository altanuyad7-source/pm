import { expect, test, type Locator, type Page } from "@playwright/test";

async function dragToColumn(page: Page, card: Locator, column: Locator) {
  const cardBox = await card.boundingBox();
  const columnBox = await column.boundingBox();
  if (!cardBox || !columnBox) throw new Error("Missing drag coordinates");
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 12 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
});

test("session survives reload and logout hides the board", async ({ page }) => {
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("loads the kanban board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await page.goto("/");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await page.goto("/");
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  await dragToColumn(page, card, targetColumn);
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  await page.reload();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("persists column renaming and card creation, editing, and deletion", async ({ page }) => {
  const column = page.getByTestId("column-col-backlog");
  await column.getByLabel("Column title").fill("Ideas");
  const rename = page.waitForResponse((response) => response.url().endsWith("/api/columns/col-backlog") && response.request().method() === "PATCH");
  await column.getByLabel("Column title").press("Enter");
  expect((await rename).ok()).toBeTruthy();
  await column.getByRole("button", { name: "Add a card" }).click();
  await column.getByLabel("Card title").fill("Lifecycle card");
  await column.getByLabel("Details", { exact: true }).fill("Original notes");
  await column.getByRole("button", { name: "Add card", exact: true }).click();
  await expect(column.getByRole("heading", { name: "Lifecycle card" })).toBeVisible();
  await page.reload();
  await expect(column.getByLabel("Column title")).toHaveValue("Ideas");
  await column.getByRole("button", { name: "Edit Lifecycle card" }).click();
  const form = column.getByRole("form", { name: "Edit card" });
  await form.getByLabel("Card title").fill("Updated lifecycle");
  await form.getByLabel("Details").fill("Saved notes");
  await form.getByRole("button", { name: "Save card" }).click();
  await expect(column.getByRole("heading", { name: "Updated lifecycle" })).toBeVisible();
  await page.reload();
  await expect(column.getByText("Saved notes")).toBeVisible();
  await column.getByRole("button", { name: "Edit Updated lifecycle" }).click();
  await column.getByRole("form", { name: "Edit card" }).getByLabel("Card title").fill("Cancelled draft");
  await column.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(column.getByRole("heading", { name: "Updated lifecycle" })).toBeVisible();
  await column.getByRole("button", { name: "Delete Updated lifecycle" }).click();
  await expect(column.getByRole("heading", { name: "Updated lifecycle" })).toHaveCount(0);
  await page.reload();
  await expect(column.getByRole("heading", { name: "Updated lifecycle" })).toHaveCount(0);
});

test("persists within-column keyboard reordering", async ({ page }) => {
  const card = page.getByRole("button", { name: "Move Refine status language", exact: true });
  await card.focus();
  await page.keyboard.press("Space", { delay: 100 });
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowDown", { delay: 100 });
  await expect(page.getByRole("status")).toContainText("card-5");
  await page.keyboard.press("Space", { delay: 100 });
  await expect(card).not.toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => {
    const board = await (await page.request.get("/api/board")).json();
    return board.columns.find((column: { id: string }) => column.id === "col-progress").cardIds;
  }).toEqual(["card-5", "card-4"]);
  await page.reload();
  await expect(page.getByTestId("column-col-progress").locator("article").first()).toHaveAttribute("data-testid", "card-card-5");
});

test("failed drag retains the saved location", async ({ page }) => {
  await page.route("**/api/cards/card-7/move", (route) => route.fulfill({ status: 500, body: '{}' }));
  const card = page.getByTestId("card-card-7");
  const source = page.getByTestId("column-col-done");
  const target = page.getByTestId("column-col-review");
  await dragToColumn(page, card, target);
  await expect(page.getByRole("alert").filter({ hasText: "Unable to save" })).toBeVisible();
  await expect(source.getByTestId("card-card-7")).toBeVisible();
  await expect(target.getByTestId("card-card-7")).toHaveCount(0);
});

test("session expiry returns to sign-in and narrow screens remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await page.request.post("/api/logout");
  await page.getByRole("button", { name: "Delete Align roadmap themes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "session expired" })).toBeVisible();
});
