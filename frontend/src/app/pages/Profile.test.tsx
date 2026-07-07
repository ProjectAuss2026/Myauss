import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Profile } from "./Profile";

const navigateMock = vi.fn();
const logoutMock = vi.fn();
const showToastMock = vi.fn();

let authState: any = {};

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

function setAuthUser(overrides: Record<string, unknown>) {
  authState = {
    user: {
      id: "member-1",
      email: "member@example.com",
      role: "USER",
      firstName: "Maya",
      lastName: "Member",
      studentId: null,
      membershipStatus: "VERIFIED",
      ...overrides,
    },
    isAuthenticated: true,
    isAdmin: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    setUserFromToken: vi.fn(),
    logout: logoutMock,
    clearError: vi.fn(),
  };
}

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
  logoutMock.mockReset();
  showToastMock.mockReset();
  setAuthUser({});
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Profile membership status", () => {
  it.each([
    {
      membershipStatus: "INACTIVE",
      label: "Inactive",
      help: "Membership is not currently verified.",
    },
    {
      membershipStatus: "NEED_REVIEW",
      label: "Need Review",
      help: "Payment proof is awaiting admin review.",
    },
    {
      membershipStatus: "VERIFIED",
      label: "Verified",
      help: "Membership is verified.",
    },
  ])("displays $label from membershipStatus", ({ membershipStatus, label, help }) => {
    setAuthUser({ membershipStatus });

    renderProfile();

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(help)).toBeTruthy();
  });

  it("shows Need Review when email is verified but membership is awaiting review", () => {
    setAuthUser({ isVerified: true, membershipStatus: "NEED_REVIEW" });

    renderProfile();

    expect(screen.getByText("Need Review")).toBeTruthy();
    expect(screen.queryByText("Verified")).toBeNull();
  });

  it("shows Inactive when email is verified but membership is inactive", () => {
    setAuthUser({ isVerified: true, membershipStatus: "INACTIVE" });

    renderProfile();

    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.queryByText("Verified")).toBeNull();
  });
});
