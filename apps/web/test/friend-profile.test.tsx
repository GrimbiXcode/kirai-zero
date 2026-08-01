import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { FriendProfilePage } from "../src/routes/FriendProfilePage";
import { mockApi, preference, renderWithProviders } from "./utils";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderProfile() {
  return renderWithProviders(
    <Routes>
      <Route path="/freunde/:userId" element={<FriendProfilePage />} />
    </Routes>,
    { route: "/freunde/friend-1" },
  );
}

describe("FriendProfilePage", () => {
  it("splits a friend's entries into gift ideas and things to avoid", async () => {
    mockApi({
      "GET /api/friends/friend-1/profile": () => ({
        user: { id: "friend-1", handle: "anna", displayName: "Anna" },
        friendsSince: "2026-01-01T10:00:00.000Z",
        likes: [
          preference({
            id: "l1",
            stance: "love",
            item: {
              id: "i1",
              slug: "buecher",
              name: "Bücher",
              kind: "gift",
              isCurated: true,
            },
          }),
        ],
        dislikes: [
          preference({
            id: "d1",
            stance: "dislike",
            item: {
              id: "i2",
              slug: "erdnuesse",
              name: "Erdnüsse",
              kind: "food",
              isCurated: true,
            },
          }),
          preference({ id: "d2", stance: "dislike" }),
        ],
      }),
    });

    renderProfile();

    const likes = await screen.findByRole("region", { name: "Mag Anna" });
    const dislikes = screen.getByRole("region", { name: "Mag Anna nicht" });

    expect(within(likes).getByText("Bücher")).toBeInTheDocument();
    expect(within(dislikes).getByText("Erdnüsse")).toBeInTheDocument();
    expect(within(dislikes).getByText("Koriander")).toBeInTheDocument();

    // The column says in plain words what an entry means, because there is no
    // reason field left to qualify it.
    expect(within(dislikes).getByText(/nicht essen bzw. wegwerfen/)).toBeInTheDocument();
  });

  it("shows a plain message when the profile is not visible", async () => {
    // The API answers 404 for a user you are not friends with; the screen must
    // not present that as a technical failure.
    mockApi({});
    renderProfile();

    expect(
      await screen.findByText(/nicht sichtbar/i),
    ).toBeInTheDocument();
  });
});
