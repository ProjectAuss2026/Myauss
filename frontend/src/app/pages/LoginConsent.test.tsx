import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Login } from "./Login";

const fetchMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => vi.fn() };
});

function fillRequiredRegistrationFields() {
  fireEvent.change(screen.getByPlaceholderText("First name"), {
    target: { value: "Ava" },
  });
  fireEvent.change(screen.getByPlaceholderText("Last name"), {
    target: { value: "Member" },
  });
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "ava@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("Create a password"), {
    target: { value: "CorrectHorseBatteryStaple!2026" },
  });
  fireEvent.change(screen.getByPlaceholderText("Confirm your password"), {
    target: { value: "CorrectHorseBatteryStaple!2026" },
  });
}

async function renderRegistration() {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Register" }));
  await screen.findByRole("heading", { name: "Member Registration" });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        message: "If your email is eligible, a verification code has been sent.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("registration consent", () => {
  it("does not submit without Privacy Policy consent", async () => {
    await renderRegistration();
    fillRequiredRegistrationFields();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I agree, by entering my name/i,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not submit without membership agreement consent", async () => {
    await renderRegistration();
    fillRequiredRegistrationFields();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I agree to the AUSS Privacy Policy",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits both affirmative consents with an otherwise valid form", async () => {
    await renderRegistration();
    fillRequiredRegistrationFields();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I agree to the AUSS Privacy Policy",
      }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I agree, by entering my name/i,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.privacyPolicyConsent).toBe(true);
    expect(body.membershipAgreementConsent).toBe(true);
  });

  it("uses a real protected new-tab link for the Privacy Policy", async () => {
    await renderRegistration();

    const link = screen.getByRole("link", { name: "Privacy Policy" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/privacy");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });
});
