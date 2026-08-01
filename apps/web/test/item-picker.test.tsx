import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ItemDto } from "shared";
import { ItemPicker } from "../src/components/ItemPicker";
import { mockApi, renderWithProviders } from "./utils";

afterEach(() => {
  vi.unstubAllGlobals();
});

const koriander: ItemDto = {
  id: "item-1",
  slug: "koriander",
  name: "Koriander",
  kind: "ingredient",
  isCurated: true,
};

describe("ItemPicker", () => {
  it("suggests catalogue entries while typing", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockApi({ "GET /api/items": () => ({ items: [koriander] }) });

    renderWithProviders(
      <ItemPicker onSelect={onSelect} excludedItemIds={new Set()} />,
    );
    await user.type(screen.getByLabelText("Etwas eintragen"), "kori");

    await user.click(await screen.findByRole("button", { name: /Koriander/ }));
    expect(onSelect).toHaveBeenCalledWith(koriander);
  });

  it("hides entries that are already on a list", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/items": () => ({ items: [koriander] }) });

    renderWithProviders(
      <ItemPicker onSelect={vi.fn()} excludedItemIds={new Set(["item-1"])} />,
    );
    await user.type(screen.getByLabelText("Etwas eintragen"), "kori");

    expect(await screen.findByText("Nichts gefunden.")).toBeInTheDocument();
  });

  it("offers to create something the catalogue does not know, asking for its kind", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const created: unknown[] = [];
    mockApi({
      "GET /api/items": () => ({ items: [] }),
      "POST /api/items": (_url, init) => {
        created.push(JSON.parse(String(init?.body)));
        return {
          item: {
            id: "item-9",
            slug: "grossmutters-guetzli",
            name: "Grossmutters Guetzli",
            kind: "food",
            isCurated: false,
          },
        };
      },
    });

    renderWithProviders(
      <ItemPicker onSelect={onSelect} excludedItemIds={new Set()} />,
    );
    await user.type(
      screen.getByLabelText("Etwas eintragen"),
      "Grossmutters Guetzli",
    );

    await user.click(await screen.findByRole("button", { name: "Lebensmittel" }));

    expect(created[0]).toEqual({
      name: "Grossmutters Guetzli",
      kind: "food",
    });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-9" }),
    );
  });
});
