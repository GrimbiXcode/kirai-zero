import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CurrentUser } from "shared";
import { Layout } from "../src/components/Layout";
import { ForgotPasswordPage } from "../src/routes/ForgotPasswordPage";
import { ResetPasswordPage } from "../src/routes/ResetPasswordPage";
import { VerifyEmailPage } from "../src/routes/VerifyEmailPage";
import { mockApi, renderWithProviders } from "./utils";

afterEach(() => {
  vi.unstubAllGlobals();
});

function error(status: number, code: string) {
  return new Response(JSON.stringify({ error: code, message: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function user(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "user-1",
    handle: "anna",
    displayName: "Anna",
    email: "anna@example.org",
    locale: "de",
    emailVerified: true,
    createdAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("ForgotPasswordPage", () => {
  it("confirms without saying whether the address is registered", async () => {
    const sent: unknown[] = [];
    mockApi({
      "POST /api/auth/password-reset": (_url, init) => {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 204 });
      },
    });
    const person = userEvent.setup();

    renderWithProviders(<ForgotPasswordPage />);
    await person.type(screen.getByLabelText("E-Mail"), "anna@example.org");
    await person.click(screen.getByRole("button", { name: "Link anfordern" }));

    const notice = await screen.findByRole("status");
    // "Wenn es zu dieser Adresse ein Konto gibt" — the wording must stay
    // conditional, because the API answers the same either way and this screen
    // must not become a way to find out who has an account here.
    expect(notice).toHaveTextContent("Wenn es zu dieser Adresse ein Konto gibt");
    expect(sent).toEqual([{ email: "anna@example.org" }]);
  });
});

describe("ResetPasswordPage", () => {
  it("posts the token from the link together with the new password", async () => {
    const sent: unknown[] = [];
    mockApi({
      "POST /api/auth/password-reset/confirm": (_url, init) => {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 204 });
      },
    });
    const person = userEvent.setup();

    renderWithProviders(<ResetPasswordPage />, { route: "/passwort-neu?token=abc" });
    await person.type(
      screen.getByLabelText("Neues Passwort"),
      "ein neues passwort",
    );
    await person.click(screen.getByRole("button", { name: "Passwort speichern" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ token: "abc", password: "ein neues passwort" });
  });

  it("explains a spent link and offers a new one", async () => {
    mockApi({
      "POST /api/auth/password-reset/confirm": () =>
        error(400, "token_invalid"),
    });
    const person = userEvent.setup();

    renderWithProviders(<ResetPasswordPage />, { route: "/passwort-neu?token=abc" });
    await person.type(screen.getByLabelText("Neues Passwort"), "ein neues passwort");
    await person.click(screen.getByRole("button", { name: "Passwort speichern" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Dieser Link ist abgelaufen oder wurde schon verwendet.",
    );
    expect(
      screen.getByRole("link", { name: "Neuen Link anfordern" }),
    ).toBeInTheDocument();
  });

  it("asks for nothing when the link carries no token", () => {
    mockApi({});
    renderWithProviders(<ResetPasswordPage />, { route: "/passwort-neu" });

    expect(screen.getByRole("alert")).toHaveTextContent("unvollständig");
    expect(screen.queryByLabelText("Neues Passwort")).toBeNull();
  });
});

describe("VerifyEmailPage", () => {
  it("redeems the token once and reports success", async () => {
    const calls: unknown[] = [];
    mockApi({
      "POST /api/auth/verify-email": (_url, init) => {
        calls.push(JSON.parse(String(init?.body)));
        return { user: user() };
      },
    });

    renderWithProviders(<VerifyEmailPage />, {
      route: "/e-mail-bestaetigen?token=abc",
    });

    expect(
      await screen.findByText(/deine E-Mail-Adresse ist bestätigt/),
    ).toBeInTheDocument();
    // Single use: React's double-invoke in development must not spend it twice.
    expect(calls).toEqual([{ token: "abc" }]);
  });

  it("reports an expired link instead of a blank screen", async () => {
    mockApi({
      "POST /api/auth/verify-email": () => error(400, "token_invalid"),
    });

    renderWithProviders(<VerifyEmailPage />, {
      route: "/e-mail-bestaetigen?token=abc",
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dieser Link ist abgelaufen oder wurde schon verwendet.",
    );
  });
});

describe("verification banner", () => {
  it("appears only while the address is unconfirmed", async () => {
    mockApi({
      "GET /api/friend-requests": () => ({ incoming: [], outgoing: [] }),
    });

    const { unmount } = renderWithProviders(
      <Layout user={user({ emailVerified: false })}>
        <p>Inhalt</p>
      </Layout>,
    );
    expect(
      screen.getByText(/E-Mail-Adresse ist noch nicht bestätigt/),
    ).toBeInTheDocument();
    // Nothing is gated behind it — the app is there either way.
    expect(screen.getByText("Inhalt")).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <Layout user={user()}>
        <p>Inhalt</p>
      </Layout>,
    );
    expect(
      screen.queryByText(/E-Mail-Adresse ist noch nicht bestätigt/),
    ).toBeNull();
  });

  it("asks for a new mail and confirms it went out", async () => {
    let resends = 0;
    mockApi({
      "GET /api/friend-requests": () => ({ incoming: [], outgoing: [] }),
      "POST /api/auth/resend-verification": () => {
        resends += 1;
        return new Response(null, { status: 204 });
      },
    });
    const person = userEvent.setup();

    renderWithProviders(
      <Layout user={user({ emailVerified: false })}>
        <p>Inhalt</p>
      </Layout>,
    );
    await person.click(
      screen.getByRole("button", { name: "Mail nochmals senden" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Mail ist unterwegs",
    );
    expect(resends).toBe(1);
  });
});
