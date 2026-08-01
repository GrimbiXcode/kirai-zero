import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { FriendProfilePage } from "../src/routes/FriendProfilePage";
import { PersonPage } from "../src/routes/PersonPage";
import { mockApi, preference, renderWithProviders } from "./utils";

afterEach(() => {
  vi.unstubAllGlobals();
});

function note(overrides: Record<string, unknown> = {}) {
  return { ...preference(), status: null, ...overrides };
}

function renderPerson() {
  return renderWithProviders(
    <Routes>
      <Route path="/personen/:personId" element={<PersonPage />} />
    </Routes>,
    { route: "/personen/p1" },
  );
}

describe("PersonPage", () => {
  it("shows an unlinked profile without any status badge", async () => {
    mockApi({
      "GET /api/persons/p1": () => ({
        person: {
          id: "p1",
          displayName: "Oma Trudi",
          note: null,
          linkedUser: null,
          entryCount: 1,
          createdAt: "2026-01-01T10:00:00.000Z",
          entries: [note()],
        },
      }),
      "GET /api/friends": () => ({ friends: [] }),
    });

    renderPerson();

    expect(await screen.findByText("Koriander")).toBeInTheDocument();
    // Nothing to compare against while unlinked, so no badge may appear.
    expect(screen.queryByText("Bestätigt")).toBeNull();
    expect(screen.queryByText("Unbestätigt")).toBeNull();
    expect(screen.getByText(/Nicht verknüpft/)).toBeInTheDocument();
  });

  it("offers linking only once there is a friend to link to", async () => {
    mockApi({
      "GET /api/persons/p1": () => ({
        person: {
          id: "p1",
          displayName: "Oma Trudi",
          note: null,
          linkedUser: null,
          entryCount: 0,
          createdAt: "2026-01-01T10:00:00.000Z",
          entries: [],
        },
      }),
      "GET /api/friends": () => ({ friends: [] }),
    });

    renderPerson();

    expect(
      await screen.findByText(/bestätigte Freundschaft/),
    ).toBeInTheDocument();
  });

  it("links a profile to the chosen friend", async () => {
    const user = userEvent.setup();
    const linked: unknown[] = [];
    mockApi({
      "GET /api/persons/p1": () => ({
        person: {
          id: "p1",
          displayName: "Ben",
          note: null,
          linkedUser: null,
          entryCount: 0,
          createdAt: "2026-01-01T10:00:00.000Z",
          entries: [],
        },
      }),
      "GET /api/friends": () => ({
        friends: [
          {
            user: { id: "u2", handle: "ben", displayName: "Ben" },
            friendsSince: "2026-01-01T10:00:00.000Z",
          },
        ],
      }),
      "POST /api/persons/p1/link": (_url, init) => {
        linked.push(JSON.parse(String(init?.body)));
        return {
          person: {
            id: "p1",
            displayName: "Ben",
            note: null,
            linkedUser: { id: "u2", handle: "ben", displayName: "Ben" },
            entryCount: 0,
            createdAt: "2026-01-01T10:00:00.000Z",
            entries: [],
          },
        };
      },
    });

    renderPerson();
    await user.selectOptions(
      await screen.findByLabelText(/Mit einem Freund verknüpfen/),
      "ben",
    );
    await user.click(screen.getByRole("button", { name: "Verknüpfen" }));

    await waitFor(() => expect(linked).toEqual([{ handle: "ben" }]));
  });

  it("shows the three statuses on a linked profile", async () => {
    mockApi({
      "GET /api/persons/p1": () => ({
        person: {
          id: "p1",
          displayName: "Ben",
          note: null,
          linkedUser: { id: "u2", handle: "ben", displayName: "Ben" },
          entryCount: 3,
          createdAt: "2026-01-01T10:00:00.000Z",
          entries: [
            note({ id: "n1", stance: "dislike", status: "confirmed" }),
            note({
              id: "n2",
              stance: "love",
              status: "contradicted",
              item: {
                id: "i2",
                slug: "buecher",
                name: "Bücher",
                kind: "gift",
                isCurated: true,
              },
            }),
            note({
              id: "n3",
              stance: "like",
              status: "unconfirmed",
              item: {
                id: "i3",
                slug: "wandern",
                name: "Wandern",
                kind: "activity",
                isCurated: true,
              },
            }),
          ],
        },
      }),
      "GET /api/friends": () => ({ friends: [] }),
    });

    renderPerson();

    const confirmed = (await screen.findByText("Koriander")).closest("button");
    expect(within(confirmed!).getByText("Bestätigt")).toBeInTheDocument();

    const contradicted = screen.getByText("Bücher").closest("button");
    expect(within(contradicted!).getByText("Widerspricht")).toBeInTheDocument();

    const unconfirmed = screen.getByText("Wandern").closest("button");
    expect(within(unconfirmed!).getByText("Unbestätigt")).toBeInTheDocument();
  });
});

describe("notes on a friend's profile", () => {
  function profileWith(myNotes: unknown[], personId: string | null) {
    return {
      user: { id: "friend-1", handle: "anna", displayName: "Anna" },
      friendsSince: "2026-01-01T10:00:00.000Z",
      likes: [],
      dislikes: [
        preference({
          id: "d1",
          stance: "dislike",
          item: {
            id: "i9",
            slug: "erdnuesse",
            name: "Erdnüsse",
            kind: "food",
            isCurated: true,
          },
        }),
      ],
      myNotes,
      personId,
    };
  }

  function renderProfile() {
    return renderWithProviders(
      <Routes>
        <Route path="/freunde/:userId" element={<FriendProfilePage />} />
      </Routes>,
      { route: "/freunde/friend-1" },
    );
  }

  it("keeps guesses out of the friend's own lists", async () => {
    mockApi({
      "GET /api/friends/friend-1/profile": () =>
        profileWith([note({ id: "n1", status: "unconfirmed" })], "p1"),
    });

    renderProfile();

    const theirs = await screen.findByRole("region", {
      name: "Mag Anna nicht",
    });
    // The friend's own list must contain only what the friend said.
    expect(within(theirs).getByText("Erdnüsse")).toBeInTheDocument();
    expect(within(theirs).queryByText("Koriander")).toBeNull();

    const mine = screen.getByRole("region", { name: "Meine Notizen zu Anna" });
    expect(within(mine).getByText("Koriander")).toBeInTheDocument();
    expect(within(mine).getByText("Unbestätigt")).toBeInTheDocument();
  });

  it("creates the container on first use", async () => {
    const user = userEvent.setup();
    let created = 0;
    mockApi({
      "GET /api/friends/friend-1/profile": () => profileWith([], null),
      "POST /api/persons/for-friend/friend-1": () => {
        created += 1;
        return {
          person: {
            id: "p1",
            displayName: "Anna",
            note: null,
            linkedUser: { id: "friend-1", handle: "anna", displayName: "Anna" },
            entryCount: 0,
            createdAt: "2026-01-01T10:00:00.000Z",
            entries: [],
          },
        };
      },
    });

    renderProfile();
    const mine = await screen.findByRole("region", {
      name: "Meine Notizen zu Anna",
    });
    await user.click(within(mine).getByRole("button", { name: "Eintragen" }));

    await waitFor(() => expect(created).toBe(1));
  });
});
