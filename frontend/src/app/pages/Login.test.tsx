import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Login } from "./Login";

const navigateMock = vi.fn();
const showToastMock = vi.fn();
const fetchMock = vi.fn();

let authState = {
  login: vi.fn(),
  setUserFromToken: vi.fn(),
};

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getRequestBody(init?: RequestInit) {
  return init?.body ? JSON.parse(String(init.body)) : null;
}

function createPaymentProofResponse(
  id = "proof-1",
  originalFilename = "receipt.jpg",
) {
  return jsonResponse({
    data: {
      id,
      originalFilename,
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      expiresAt: "2026-07-06T00:00:00.000Z",
    },
  });
}

function installFetchMock(
  options: {
    uploadHandler?: (init?: RequestInit) => Promise<Response> | Response;
    deleteHandler?: (
      url: string,
      init?: RequestInit,
    ) => Promise<Response> | Response;
    registerHandler?: (init?: RequestInit) => Promise<Response> | Response;
  } = {},
) {
  fetchMock.mockImplementation(
    (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method || "GET";

      if (url === "/api/auth/payment-proofs/pending" && method === "POST") {
        if (options.uploadHandler) {
          return options.uploadHandler(init);
        }
        return Promise.resolve(createPaymentProofResponse());
      }

      if (
        url.startsWith("/api/auth/payment-proofs/pending/") &&
        method === "DELETE"
      ) {
        if (options.deleteHandler) {
          return options.deleteHandler(url, init);
        }
        return Promise.resolve(jsonResponse({ data: { removed: true } }));
      }

      if (url === "/api/auth/register" && method === "POST") {
        if (options.registerHandler) {
          return options.registerHandler(init);
        }
        return Promise.resolve(
          jsonResponse({
            message:
              "If your email is eligible, a verification code has been sent.",
            pendingMembershipReview: false,
          }),
        );
      }

      return Promise.resolve(jsonResponse({}));
    },
  );
}

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

async function openRegisterView() {
  renderLoginPage();
  fireEvent.click(screen.getByRole("button", { name: "Register" }));
  await screen.findByRole("heading", { name: "Member Registration" });
}

function fillRegisterFields() {
  fireEvent.change(screen.getByPlaceholderText("First name"), {
    target: { value: "Ava" },
  });
  fireEvent.change(screen.getByPlaceholderText("Last name"), {
    target: { value: "Member" },
  });
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "ava@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("e.g. 123456789"), {
    target: { value: "123456789" },
  });
  fireEvent.change(screen.getByPlaceholderText("Create a password"), {
    target: { value: "CorrectHorseBatteryStaple!2026" },
  });
  fireEvent.change(screen.getByPlaceholderText("Confirm your password"), {
    target: { value: "CorrectHorseBatteryStaple!2026" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

function createProofFile(name = "receipt.jpg", type = "image/jpeg") {
  return new File(["proof-bytes"], name, { type });
}

beforeEach(() => {
  navigateMock.mockReset();
  showToastMock.mockReset();
  fetchMock.mockReset();
  authState = {
    login: vi.fn(),
    setUserFromToken: vi.fn(),
  };
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }

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

describe("Login registration payment proof flow", () => {
  it("shows the Cash / Bank Transfer option during registration", async () => {
    installFetchMock();
    await openRegisterView();

    expect(screen.getByText("Cash / Bank Transfer")).toBeTruthy();
    expect(screen.getByText("Standard Registration")).toBeTruthy();
  });

  it("shows the payment proof upload UI when Cash / Bank Transfer is selected", async () => {
    installFetchMock();
    await openRegisterView();

    fireEvent.click(screen.getByText("Cash / Bank Transfer"));

    expect(await screen.findByText("Payment Proof Uploads")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Upload Payment Proofs" }),
    ).toBeTruthy();
  });

  it("blocks final submit when Cash / Bank Transfer is selected without any uploaded proof", async () => {
    installFetchMock();
    await openRegisterView();
    fillRegisterFields();
    fireEvent.click(screen.getByText("Cash / Bank Transfer"));

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(
      await screen.findByText(
        "Upload at least one payment proof before submitting Cash / Bank Transfer registration.",
      ),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the uploaded proofUploadId and sends paymentMethod plus proofUploadIds on final submit", async () => {
    const registerHandler = vi.fn((init?: RequestInit) => {
      const body = getRequestBody(init);
      expect(body.paymentMethod).toBe("CASH_BANK_TRANSFER");
      expect(body.proofUploadIds).toEqual(["proof-123"]);

      return Promise.resolve(
        jsonResponse({
          message:
            "If your email is eligible, a verification code has been sent.",
          pendingMembershipReview: true,
        }),
      );
    });
    installFetchMock({
      uploadHandler: () =>
        Promise.resolve(createPaymentProofResponse("proof-123")),
      registerHandler,
    });

    await openRegisterView();
    fillRegisterFields();
    fireEvent.click(screen.getByText("Cash / Bank Transfer"));

    fireEvent.change(screen.getByLabelText("Upload payment proof files"), {
      target: { files: [createProofFile()] },
    });

    expect(await screen.findByText("receipt.jpg")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(registerHandler).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a clear error when a proof upload fails", async () => {
    installFetchMock({
      uploadHandler: () =>
        Promise.resolve(
          jsonResponse({ error: "SVG files are not allowed." }, 415),
        ),
    });

    await openRegisterView();
    fireEvent.click(screen.getByText("Cash / Bank Transfer"));
    fireEvent.change(screen.getByLabelText("Upload payment proof files"), {
      target: { files: [createProofFile("receipt.svg", "image/svg+xml")] },
    });

    expect(await screen.findByText("SVG files are not allowed.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retry upload for receipt.svg" }),
    ).toBeTruthy();
  });

  it("allows retrying a failed proof upload", async () => {
    let attempts = 0;
    installFetchMock({
      uploadHandler: () => {
        attempts += 1;
        if (attempts === 1) {
          return Promise.resolve(
            jsonResponse({ error: "Upload failed." }, 500),
          );
        }

        return Promise.resolve(createPaymentProofResponse("proof-retry"));
      },
    });

    await openRegisterView();
    fireEvent.click(screen.getByText("Cash / Bank Transfer"));
    fireEvent.change(screen.getByLabelText("Upload payment proof files"), {
      target: { files: [createProofFile()] },
    });

    expect(await screen.findByText("Upload failed.")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Retry upload for receipt.jpg" }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Upload failed.")).toBeNull();
    });
  });

  it("allows removing an uploaded proof before final submit", async () => {
    const deleteHandler = vi.fn(() =>
      Promise.resolve(jsonResponse({ data: { removed: true } })),
    );
    installFetchMock({
      uploadHandler: () =>
        Promise.resolve(createPaymentProofResponse("proof-delete")),
      deleteHandler,
    });

    await openRegisterView();
    fireEvent.click(screen.getByText("Cash / Bank Transfer"));
    fireEvent.change(screen.getByLabelText("Upload payment proof files"), {
      target: { files: [createProofFile()] },
    });

    expect(await screen.findByText("receipt.jpg")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove upload receipt.jpg" }),
    );

    await waitFor(() => {
      expect(deleteHandler).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("receipt.jpg")).toBeNull();
    });
  });

  it("shows a pending admin review confirmation after successful Cash / Bank Transfer registration", async () => {
    installFetchMock({
      uploadHandler: () =>
        Promise.resolve(createPaymentProofResponse("proof-pending")),
      registerHandler: () =>
        Promise.resolve(
          jsonResponse({
            message:
              "If your email is eligible, a verification code has been sent.",
            pendingMembershipReview: true,
          }),
        ),
    });

    await openRegisterView();
    fillRegisterFields();
    fireEvent.click(screen.getByText("Cash / Bank Transfer"));
    fireEvent.change(screen.getByLabelText("Upload payment proof files"), {
      target: { files: [createProofFile()] },
    });

    expect(await screen.findByText("receipt.jpg")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.stringContaining("pending admin review"),
        "info",
      );
      expect(navigateMock).toHaveBeenCalledWith("/verify", {
        state: expect.objectContaining({
          email: "ava@example.com",
          pendingMembershipReview: true,
        }),
      });
    });
  });

  it("preserves the existing non-cash registration behaviour", async () => {
    const registerHandler = vi.fn((init?: RequestInit) => {
      const body = getRequestBody(init);
      expect(body.paymentMethod).toBeUndefined();
      expect(body.proofUploadIds).toBeUndefined();

      return Promise.resolve(
        jsonResponse({
          message:
            "If your email is eligible, a verification code has been sent.",
          pendingMembershipReview: false,
        }),
      );
    });
    installFetchMock({ registerHandler });

    await openRegisterView();
    fillRegisterFields();
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(registerHandler).toHaveBeenCalledTimes(1);
      expect(showToastMock).toHaveBeenCalledWith(
        "If your email is eligible, a verification code has been sent.",
        "info",
      );
    });
  });
});
