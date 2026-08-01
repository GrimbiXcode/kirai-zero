import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyListsPage } from "../src/routes/MyListsPage";
import { mockApi, preference, renderWithProviders } from "./utils";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MyListsPage", () => {
  it("sorts entries into the liked and disliked columns", async () => {
    mockApi({
      "GET /api/me/preferences": () => ({
        preferences: [
          preference({ id: "a", stance: "dislike" }),
          preference({
            id: "b",
            stance: "love",
            item: {
              id: "item-2",
              slug: "buecher",
              name: "Bücher",
              kind: "gift",
              isCurated: true,
            },
          }),
        ],
      }),
    });

    renderWithProviders(<MyListsPage />);

    const likes = await screen.findByRole("region", { name: "Mag ich" });
    const dislikes = screen.getByRole("region", { name: "Mag ich nicht" });

    expect(within(likes).getByText("Bücher")).toBeInTheDocument();
    expect(within(dislikes).getByText("Koriander")).toBeInTheDocument();
    // A disliked item must never show up on the "likes" side, which is the
    // whole point of the screen.
    expect(within(likes).queryByText("Koriander")).toBeNull();
  });

  it("hides nothing from the owner", async () => {
    mockApi({
      "GET /api/me/preferences": () => ({
        preferences: [
          preference({
            id: "b",
            stance: "dislike",
            visibility: "private",
            item: {
              id: "item-4",
              slug: "lakritz",
              name: "Lakritz",
              kind: "food",
              isCurated: true,
            },
          }),
        ],
      }),
    });

    renderWithProviders(<MyListsPage />);

    // The owner always sees their private entries in their own list.
    const privateRow = (await screen.findByText("Lakritz")).closest("button");
    expect(within(privateRow!).getByText("Nur für mich")).toBeInTheDocument();
  });

  it("opens the editor for an existing entry", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/me/preferences": () => ({ preferences: [preference()] }),
    });

    renderWithProviders(<MyListsPage />);
    await user.click(await screen.findByText("Koriander"));

    const dialog = await screen.findByRole("dialog", { name: "Koriander" });
    // The current stance comes back pre-selected, so editing starts from the
    // saved state instead of a blank form.
    expect(
      within(dialog).getByRole("button", { name: "Mag ich nicht" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("saves as soon as a stance is picked", async () => {
    const user = userEvent.setup();
    const saved: unknown[] = [];
    mockApi({
      "GET /api/me/preferences": () => ({ preferences: [preference()] }),
      "PUT /api/me/preferences/item-1": (_url, init) => {
        saved.push(JSON.parse(String(init?.body)));
        return { preference: preference({ stance: "like" }) };
      },
    });

    renderWithProviders(<MyListsPage />);
    await user.click(await screen.findByText("Koriander"));
    const dialog = await screen.findByRole("dialog", { name: "Koriander" });
    await user.click(within(dialog).getByRole("button", { name: "Mag ich" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ stance: "like", visibility: "friends" });
  });

});
