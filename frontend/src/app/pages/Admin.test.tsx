import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Admin } from "./Admin";

const navigateMock = vi.fn();
const logoutMock = vi.fn();
const showToastMock = vi.fn();
const fetchMock = vi.fn();
const createObjectUrlMock = vi.fn();
const revokeObjectUrlMock = vi.fn();

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

let authState = {
  user: {
    id: "admin-1",
    email: "admin@example.com",
    role: "ADMIN",
    firstName: "Admin",
    lastName: "User",
    studentId: null,
  },
  isAuthenticated: true,
  isAdmin: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  setUserFromToken: vi.fn(),
  logout: logoutMock,
  clearError: vi.fn(),
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function binaryResponse(
  body: BodyInit,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {};
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

const sampleMembers = [
  {
    id: "member-1",
    email: "alice@example.com",
    role: "USER",
    firstName: "Alice",
    lastName: "Nguyen",
    studentId: "123456789",
    createdAt: "2026-05-01T12:00:00.000Z",
    membershipStatus: "VERIFIED",
  },
  {
    id: "member-2",
    email: "bruce@example.com",
    role: "ADMIN",
    firstName: "Bruce",
    lastName: "Lee",
    studentId: null,
    createdAt: "2026-05-03T12:00:00.000Z",
    membershipStatus: "NEED_REVIEW",
  },
  {
    id: "member-3",
    email: "charlie@example.com",
    role: "USER",
    fullName: "Charlie Kim",
    studentId: "555111222",
    createdAt: "2026-05-04T12:00:00.000Z",
    membershipStatus: "INACTIVE",
  },
];

const pageTwoMember = {
  id: "member-21",
  email: "page2@example.com",
  role: "USER",
  firstName: "Page",
  lastName: "Two",
  studentId: null,
  createdAt: "2026-05-05T12:00:00.000Z",
  membershipStatus: "VERIFIED",
};

const sampleProofs = [
  {
    id: "proof-1",
    originalFilename: "receipt.png",
    mimeType: "image/png",
    sizeBytes: 2048,
    status: "LINKED",
    createdAt: "2026-05-03T12:15:00.000Z",
    expiresAt: "2026-05-04T12:15:00.000Z",
    linkedAt: "2026-05-03T12:16:00.000Z",
  },
];

const proofImageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function membersResponse(
  members: unknown[],
  options: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
    hasPreviousPage?: boolean;
    hasNextPage?: boolean;
  } = {},
): Response {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const total = options.total ?? members.length;
  const totalPages =
    options.totalPages ?? Math.max(1, Math.ceil(total / pageSize));

  return jsonResponse({
    data: members,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPreviousPage: options.hasPreviousPage ?? page > 1,
      hasNextPage: options.hasNextPage ?? page < totalPages,
    },
  });
}

function proofMetadataResponse(proofs: unknown[] = sampleProofs): Response {
  return jsonResponse({ data: proofs });
}

function getRequestParams(url: string): URLSearchParams {
  return new URL(url, "http://localhost").searchParams;
}

function installFetchMock(
  options: {
    membersHandler?: (
      url: string,
      init?: RequestInit,
    ) => Promise<Response> | Response;
    paymentProofsHandler?: (
      userId: string,
      url: string,
      init?: RequestInit,
    ) => Promise<Response> | Response;
    proofFileHandler?: (
      proofId: string,
      url: string,
      init?: RequestInit,
    ) => Promise<Response> | Response;
    statusHandler?: (
      userId: string,
      url: string,
      init?: RequestInit,
    ) => Promise<Response> | Response;
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

      const paymentProofsMatch = url.match(
        /^\/api\/auth\/admin\/members\/([^/]+)\/payment-proofs$/,
      );
      if (paymentProofsMatch) {
        if (options.paymentProofsHandler) {
          return options.paymentProofsHandler(paymentProofsMatch[1], url, init);
        }

        return Promise.resolve(proofMetadataResponse());
      }

      const statusMatch = url.match(
        /^\/api\/auth\/admin\/members\/([^/]+)\/status$/,
      );
      if (statusMatch) {
        if (options.statusHandler) {
          return options.statusHandler(statusMatch[1], url, init);
        }

        return Promise.resolve(
          jsonResponse({
            data: {
              ...sampleMembers[1],
              membershipStatus: "VERIFIED",
            },
          }),
        );
      }

      const proofFileMatch = url.match(
        /^\/api\/auth\/admin\/payment-proofs\/([^/]+)\/file$/,
      );
      if (proofFileMatch) {
        if (options.proofFileHandler) {
          return options.proofFileHandler(proofFileMatch[1], url, init);
        }

        return Promise.resolve(
          binaryResponse(proofImageBytes, {
            headers: {
              "Content-Type": "image/png",
              "Content-Disposition": 'attachment; filename="receipt.png"',
            },
          }),
        );
      }

      if (url.startsWith("/api/auth/admin/members")) {
        if (options.membersHandler) {
          return options.membersHandler(url, init);
        }
        return Promise.resolve(membersResponse(sampleMembers));
      }

      switch (url) {
        case "/api/sponsorship":
          return Promise.resolve(
            jsonResponse({ data: { id: 1, sponsors: [] } }),
          );
        case "/api/media-entries":
          return Promise.resolve(jsonResponse({ data: [] }));
        case "/api/activities/all":
          return Promise.resolve(jsonResponse([]));
        case "/api/admin/executives":
        case "/api/admin/exec-roles":
        case "/api/admin/exec-teams":
        case "/api/admin/faq":
          return Promise.resolve(jsonResponse({ data: [] }));
        default:
          return Promise.resolve(jsonResponse({}));
      }
    },
  );
}

function renderMembersView() {
  localStorage.setItem("admin_tab", "members");
  return render(<Admin />);
}

async function openReviewPaymentDialog(memberName = "Bruce Lee") {
  const row = await screen.findByText(memberName);
  const rowElement = row.closest("tr");
  expect(rowElement).toBeTruthy();

  fireEvent.click(
    within(rowElement as HTMLTableRowElement).getByRole("button", {
      name: "Review payment",
    }),
  );

  return screen.findByRole("dialog", { name: "Review payment proof" });
}

beforeEach(() => {
  localStorage.clear();
  navigateMock.mockReset();
  logoutMock.mockReset();
  showToastMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  createObjectUrlMock.mockReset();
  createObjectUrlMock.mockReturnValue("blob:proof-preview");
  revokeObjectUrlMock.mockReset();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectUrlMock,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectUrlMock,
  });
  authState = {
    user: {
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      firstName: "Admin",
      lastName: "User",
      studentId: null,
    },
    isAuthenticated: true,
    isAdmin: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    setUserFromToken: vi.fn(),
    logout: logoutMock,
    clearError: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();

  if (originalCreateObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
  } else {
    Reflect.deleteProperty(URL, "createObjectURL");
  }

  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  } else {
    Reflect.deleteProperty(URL, "revokeObjectURL");
  }
});

describe("Admin membership roster", () => {
  it("renders the members tab heading and filter controls", async () => {
    installFetchMock();

    renderMembersView();

    expect(screen.getByRole("button", { name: "Members" })).toBeTruthy();
    expect(await screen.findByText("Membership Roster")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Search by name, email, or student ID"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inactive" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Need Review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Verified" })).toBeTruthy();
  });

  it("includes page 1 and page size 20 on the initial request and renders pagination metadata", async () => {
    const membersHandler = vi.fn((url: string) => {
      const params = getRequestParams(url);
      expect(params.get("page")).toBe("1");
      expect(params.get("pageSize")).toBe("20");

      return Promise.resolve(
        membersResponse(sampleMembers, {
          page: 1,
          pageSize: 20,
          total: 45,
          totalPages: 3,
          hasNextPage: true,
        }),
      );
    });
    installFetchMock({ membersHandler });

    renderMembersView();

    expect(await screen.findByText("Alice Nguyen")).toBeTruthy();
    expect(screen.getByText("Showing 1–3 of 45")).toBeTruthy();
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();
  });

  it("does not refetch on every keystroke and sends the search query after debounce", async () => {
    const membersHandler = vi.fn((url: string) => {
      const params = getRequestParams(url);

      if (params.get("page") === "2") {
        return Promise.resolve(
          membersResponse([pageTwoMember], {
            page: 2,
            pageSize: 20,
            total: 21,
            totalPages: 2,
            hasPreviousPage: true,
            hasNextPage: false,
          }),
        );
      }

      if (url.includes("search=alice")) {
        return Promise.resolve(
          membersResponse([sampleMembers[0]], {
            page: 1,
            pageSize: 20,
            total: 1,
          }),
        );
      }

      return Promise.resolve(
        membersResponse(sampleMembers, {
          page: 1,
          pageSize: 20,
          total: 21,
          totalPages: 2,
          hasNextPage: true,
        }),
      );
    });
    installFetchMock({ membersHandler });

    renderMembersView();
    await screen.findByText("Alice Nguyen");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page Two");

    membersHandler.mockClear();
    vi.useFakeTimers();

    const searchInput = screen.getByPlaceholderText(
      "Search by name, email, or student ID",
    );
    fireEvent.change(searchInput, { target: { value: "a" } });
    fireEvent.change(searchInput, { target: { value: "al" } });
    fireEvent.change(searchInput, { target: { value: "alice" } });

    expect(membersHandler).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(membersHandler).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(membersHandler).toHaveBeenCalledTimes(1);
      const [url] = membersHandler.mock.calls[0];
      expect(url).toContain("search=alice");
      expect(url).toContain("page=1");
      expect(url).toContain("pageSize=20");
    });

    expect(await screen.findByText("Alice Nguyen")).toBeTruthy();
    expect(screen.queryByText("Page Two")).toBeNull();
  });

  it("still sends the correct status filter and combines it with search", async () => {
    const membersHandler = vi.fn((url: string) => {
      const params = getRequestParams(url);

      if (params.get("page") === "2") {
        return Promise.resolve(
          membersResponse([pageTwoMember], {
            page: 2,
            pageSize: 20,
            total: 21,
            totalPages: 2,
            hasPreviousPage: true,
            hasNextPage: false,
          }),
        );
      }

      if (url.includes("status=VERIFIED") && url.includes("search=alice")) {
        return Promise.resolve(
          membersResponse([sampleMembers[0]], {
            page: 1,
            pageSize: 20,
            total: 1,
          }),
        );
      }

      return Promise.resolve(
        membersResponse(sampleMembers, {
          page: 1,
          pageSize: 20,
          total: 21,
          totalPages: 2,
          hasNextPage: true,
        }),
      );
    });
    installFetchMock({ membersHandler });

    renderMembersView();
    await screen.findByText("Alice Nguyen");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page Two");

    vi.useFakeTimers();
    const searchInput = screen.getByPlaceholderText(
      "Search by name, email, or student ID",
    );
    fireEvent.change(searchInput, { target: { value: "alice" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(
        membersHandler.mock.calls.some(([url]) =>
          String(url).includes("search=alice"),
        ),
      ).toBe(true);
    });

    membersHandler.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Verified" }));

    await waitFor(() => {
      expect(membersHandler).toHaveBeenCalledTimes(1);
      const [url] = membersHandler.mock.calls[0];
      expect(url).toContain("status=VERIFIED");
      expect(url).toContain("search=alice");
      expect(url).toContain("page=1");
    });
  });

  it("clicking Next and Previous fetches adjacent pages", async () => {
    const membersHandler = vi.fn((url: string) => {
      const params = getRequestParams(url);
      if (params.get("page") === "2") {
        return Promise.resolve(
          membersResponse([pageTwoMember], {
            page: 2,
            pageSize: 20,
            total: 21,
            totalPages: 2,
            hasPreviousPage: true,
            hasNextPage: false,
          }),
        );
      }

      return Promise.resolve(
        membersResponse(sampleMembers, {
          page: 1,
          pageSize: 20,
          total: 21,
          totalPages: 2,
          hasNextPage: true,
        }),
      );
    });
    installFetchMock({ membersHandler });

    renderMembersView();
    await screen.findByText("Alice Nguyen");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page Two")).toBeTruthy();
    expect(
      membersHandler.mock.calls.some(([url]) => String(url).includes("page=2")),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Alice Nguyen")).toBeTruthy();
    expect(
      membersHandler.mock.calls.some(([url]) => String(url).includes("page=1")),
    ).toBe(true);
  });

  it("renders backend-returned search results in the table", async () => {
    installFetchMock({
      membersHandler: (url: string) => {
        if (url.includes("search=charlie")) {
          return Promise.resolve(
            membersResponse([sampleMembers[2]], {
              page: 1,
              pageSize: 20,
              total: 1,
            }),
          );
        }
        return Promise.resolve(membersResponse(sampleMembers));
      },
    });

    renderMembersView();
    await screen.findByText("Alice Nguyen");

    vi.useFakeTimers();
    const searchInput = screen.getByPlaceholderText(
      "Search by name, email, or student ID",
    );
    fireEvent.change(searchInput, { target: { value: "charlie" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();

    const charlieRow = await screen.findByText("Charlie Kim");
    expect(charlieRow).toBeTruthy();
    expect(screen.queryByText("Alice Nguyen")).toBeNull();
    expect(screen.queryByText("Bruce Lee")).toBeNull();
  });

  it("shows a no-results state when the backend returns an empty search result", async () => {
    installFetchMock({
      membersHandler: (url: string) => {
        if (url.includes("search=missing")) {
          return Promise.resolve(
            membersResponse([], {
              page: 1,
              pageSize: 20,
              total: 0,
            }),
          );
        }
        return Promise.resolve(membersResponse(sampleMembers));
      },
    });

    renderMembersView();
    await screen.findByText("Alice Nguyen");

    vi.useFakeTimers();
    const searchInput = screen.getByPlaceholderText(
      "Search by name, email, or student ID",
    );
    fireEvent.change(searchInput, { target: { value: "missing" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();

    expect(
      await screen.findByText(
        "No members match your current search and filter",
      ),
    ).toBeTruthy();
  });

  it("shows the empty state when the paginated backend returns no members without filters", async () => {
    installFetchMock({
      membersHandler: () =>
        Promise.resolve(
          membersResponse([], {
            page: 1,
            pageSize: 20,
            total: 0,
          }),
        ),
    });

    renderMembersView();

    expect(await screen.findByText("No registered members yet")).toBeTruthy();
  });

  it("changing page size resets to page 1 and uses the new page size", async () => {
    const membersHandler = vi.fn((url: string) => {
      const params = getRequestParams(url);

      if (params.get("pageSize") === "50") {
        return Promise.resolve(
          membersResponse(sampleMembers, {
            page: 1,
            pageSize: 50,
            total: 60,
            totalPages: 2,
            hasNextPage: true,
          }),
        );
      }

      if (params.get("page") === "2") {
        return Promise.resolve(
          membersResponse([pageTwoMember], {
            page: 2,
            pageSize: 20,
            total: 21,
            totalPages: 2,
            hasPreviousPage: true,
            hasNextPage: false,
          }),
        );
      }

      return Promise.resolve(
        membersResponse(sampleMembers, {
          page: 1,
          pageSize: 20,
          total: 21,
          totalPages: 2,
          hasNextPage: true,
        }),
      );
    });
    installFetchMock({ membersHandler });

    renderMembersView();
    await screen.findByText("Alice Nguyen");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page Two");

    membersHandler.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "50" }));

    await waitFor(() => {
      const [url] = membersHandler.mock.calls[0];
      expect(url).toContain("page=1");
      expect(url).toContain("pageSize=50");
    });
  });

  it("combines search, status, and page size in the request", async () => {
    const membersHandler = vi.fn((url: string) => {
      if (
        url.includes("status=VERIFIED") &&
        url.includes("search=alice") &&
        url.includes("page=1") &&
        url.includes("pageSize=50")
      ) {
        return Promise.resolve(
          membersResponse([sampleMembers[0]], {
            page: 1,
            pageSize: 50,
            total: 1,
          }),
        );
      }

      return Promise.resolve(
        membersResponse(sampleMembers, {
          page: 1,
          pageSize: 20,
          total: 21,
          totalPages: 2,
          hasNextPage: true,
        }),
      );
    });
    installFetchMock({ membersHandler });

    renderMembersView();
    await screen.findByText("Alice Nguyen");

    fireEvent.click(screen.getByRole("button", { name: "50" }));
    await waitFor(() => {
      expect(
        membersHandler.mock.calls.some(([url]) =>
          String(url).includes("pageSize=50"),
        ),
      ).toBe(true);
    });

    vi.useFakeTimers();
    const searchInput = screen.getByPlaceholderText(
      "Search by name, email, or student ID",
    );
    fireEvent.change(searchInput, { target: { value: "alice" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "Verified" }));

    await waitFor(() => {
      const [url] =
        membersHandler.mock.calls[membersHandler.mock.calls.length - 1];
      expect(url).toContain("status=VERIFIED");
      expect(url).toContain("search=alice");
      expect(url).toContain("page=1");
      expect(url).toContain("pageSize=50");
    });
  });

  it("disables previous and next correctly at the first and last pages", async () => {
    const membersHandler = vi.fn((url: string) => {
      const params = getRequestParams(url);
      if (params.get("page") === "2") {
        return Promise.resolve(
          membersResponse([pageTwoMember], {
            page: 2,
            pageSize: 20,
            total: 21,
            totalPages: 2,
            hasPreviousPage: true,
            hasNextPage: false,
          }),
        );
      }

      return Promise.resolve(
        membersResponse(sampleMembers, {
          page: 1,
          pageSize: 20,
          total: 21,
          totalPages: 2,
          hasPreviousPage: false,
          hasNextPage: true,
        }),
      );
    });
    installFetchMock({ membersHandler });

    renderMembersView();
    await screen.findByText("Alice Nguyen");

    expect(
      (screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page Two");

    expect(
      (screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows a loading state while the roster is being fetched", async () => {
    const deferredMembers = createDeferred<Response>();
    installFetchMock({
      membersHandler: () => deferredMembers.promise,
    });

    renderMembersView();

    expect(await screen.findByText("Loading member roster...")).toBeTruthy();

    deferredMembers.resolve(membersResponse(sampleMembers));
    await screen.findByText("Alice Nguyen");
  });

  it("shows an error state when the roster request fails", async () => {
    installFetchMock({
      membersHandler: () =>
        Promise.resolve(jsonResponse({ error: "Roster unavailable" }, 500)),
    });

    renderMembersView();

    expect(await screen.findByText("Roster unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("keeps the existing status badge labels", async () => {
    installFetchMock();

    renderMembersView();

    const aliceRow = await screen.findByText("Alice Nguyen");
    const verifiedRow = aliceRow.closest("tr");
    expect(verifiedRow).toBeTruthy();
    expect(
      within(verifiedRow as HTMLTableRowElement).getByText("Verified"),
    ).toBeTruthy();

    const reviewRow = screen.getByText("Bruce Lee").closest("tr");
    expect(reviewRow).toBeTruthy();
    expect(
      within(reviewRow as HTMLTableRowElement).getByText("Need Review"),
    ).toBeTruthy();

    const inactiveRow = screen.getByText("Charlie Kim").closest("tr");
    expect(inactiveRow).toBeTruthy();
    expect(
      within(inactiveRow as HTMLTableRowElement).getByText("Inactive"),
    ).toBeTruthy();
  });

  it("shows Review payment only for Need Review rows", async () => {
    installFetchMock();

    renderMembersView();

    const reviewRow = (await screen.findByText("Bruce Lee")).closest("tr");
    const verifiedRow = screen.getByText("Alice Nguyen").closest("tr");
    const inactiveRow = screen.getByText("Charlie Kim").closest("tr");

    expect(reviewRow).toBeTruthy();
    expect(verifiedRow).toBeTruthy();
    expect(inactiveRow).toBeTruthy();

    expect(
      within(reviewRow as HTMLTableRowElement).getByRole("button", {
        name: "Review payment",
      }),
    ).toBeTruthy();
    expect(
      within(verifiedRow as HTMLTableRowElement).queryByRole("button", {
        name: "Review payment",
      }),
    ).toBeNull();
    expect(
      within(inactiveRow as HTMLTableRowElement).queryByRole("button", {
        name: "Review payment",
      }),
    ).toBeNull();
  });

  it("opens the review modal, loads proof metadata, and previews the secure proof file", async () => {
    const deferredProofFile = createDeferred<Response>();
    const paymentProofsHandler = vi.fn(() => proofMetadataResponse());
    const proofFileHandler = vi.fn(() => deferredProofFile.promise);

    installFetchMock({ paymentProofsHandler, proofFileHandler });

    renderMembersView();
    const dialog = await openReviewPaymentDialog();

    expect(paymentProofsHandler).toHaveBeenCalledTimes(1);
    const [proofUserId, proofUrl, proofInit] = paymentProofsHandler.mock
      .calls[0] as unknown as [string, string, RequestInit | undefined];
    expect(proofUserId).toBe("member-2");
    expect(proofUrl).toBe("/api/auth/admin/members/member-2/payment-proofs");
    expect(proofInit?.credentials).toBe("include");
    expect(within(dialog).getByText("Bruce Lee")).toBeTruthy();
    expect(within(dialog).getByText("bruce@example.com")).toBeTruthy();
    expect(within(dialog).getByText("member-2")).toBeTruthy();
    expect(within(dialog).getByText("Need Review")).toBeTruthy();
    expect(await within(dialog).findByText("receipt.png")).toBeTruthy();
    expect((await within(dialog).findAllByText("Linked")).length).toBe(2);
    expect(
      await within(dialog).findByText("Loading proof preview..."),
    ).toBeTruthy();

    deferredProofFile.resolve(
      binaryResponse(proofImageBytes, {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": 'attachment; filename="receipt.png"',
        },
      }),
    );

    const preview = await within(dialog).findByAltText(
      "Payment proof preview for Bruce Lee",
    );
    expect(preview.getAttribute("src")).toBe("blob:proof-preview");
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(
      within(dialog).getByRole("link", { name: "Open proof" }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("link", { name: "Download proof" }),
    ).toBeTruthy();
  });

  it("shows a loading state while proof metadata is fetched", async () => {
    const deferredProofs = createDeferred<Response>();
    installFetchMock({
      paymentProofsHandler: () => deferredProofs.promise,
    });

    renderMembersView();
    const dialog = await openReviewPaymentDialog();

    expect(
      await within(dialog).findByText("Loading payment proof details..."),
    ).toBeTruthy();

    deferredProofs.resolve(proofMetadataResponse());
    expect(await within(dialog).findByText("receipt.png")).toBeTruthy();
  });

  it("shows an error state when proof metadata loading fails", async () => {
    installFetchMock({
      paymentProofsHandler: () =>
        Promise.resolve(
          jsonResponse({ error: "Proof metadata unavailable" }, 500),
        ),
    });

    renderMembersView();
    const dialog = await openReviewPaymentDialog();

    expect(
      await within(dialog).findByText("Failed to load payment proof metadata"),
    ).toBeTruthy();
    expect(within(dialog).getByText("Proof metadata unavailable")).toBeTruthy();
  });

  it("shows an empty state when no payment proof is available", async () => {
    installFetchMock({
      paymentProofsHandler: () => Promise.resolve(proofMetadataResponse([])),
    });

    renderMembersView();
    const dialog = await openReviewPaymentDialog();

    expect(
      await within(dialog).findByText("No payment proof uploaded"),
    ).toBeTruthy();
    const approveButton = within(dialog).getByRole("button", {
      name: "Approve membership",
    }) as HTMLButtonElement;
    expect(approveButton.disabled).toBe(true);
    const declineButton = within(dialog).getByRole("button", {
      name: "Decline",
    }) as HTMLButtonElement;
    expect(declineButton.disabled).toBe(true);
  });

  it("shows a proof file error while keeping the modal open", async () => {
    installFetchMock({
      paymentProofsHandler: () => Promise.resolve(proofMetadataResponse()),
      proofFileHandler: () =>
        Promise.resolve(
          jsonResponse({ error: "Payment proof file not found" }, 404),
        ),
    });

    renderMembersView();
    const dialog = await openReviewPaymentDialog();

    expect(
      await within(dialog).findByText("Could not load payment proof preview."),
    ).toBeTruthy();
    expect(
      within(dialog).getByText("Payment proof file not found"),
    ).toBeTruthy();
    expect(
      screen.getByRole("dialog", { name: "Review payment proof" }),
    ).toBeTruthy();
  });

  it("approves a Need Review member, sends the approval request body, and refreshes the filtered roster", async () => {
    let approved = false;
    const deferredStatus = createDeferred<Response>();

    installFetchMock({
      membersHandler: (url: string) => {
        if (url.includes("status=NEED_REVIEW")) {
          return Promise.resolve(
            membersResponse(
              approved ? [] : [sampleMembers[1]],
              approved
                ? { page: 1, pageSize: 20, total: 0 }
                : { page: 1, pageSize: 20, total: 1 },
            ),
          );
        }

        return Promise.resolve(membersResponse(sampleMembers));
      },
      paymentProofsHandler: () => Promise.resolve(proofMetadataResponse()),
      proofFileHandler: () =>
        Promise.resolve(
          binaryResponse(proofImageBytes, {
            headers: {
              "Content-Type": "image/png",
              "Content-Disposition": 'attachment; filename="receipt.png"',
            },
          }),
        ),
      statusHandler: async (userId, _url, init) => {
        expect(userId).toBe("member-2");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          status: "VERIFIED",
          reason: "Payment proof approved",
        });
        return deferredStatus.promise;
      },
    });

    renderMembersView();
    await screen.findByText("Alice Nguyen");
    fireEvent.click(screen.getByRole("button", { name: "Need Review" }));
    await screen.findByText("Bruce Lee");

    const dialog = await openReviewPaymentDialog();
    const approveButton = (await within(dialog).findByRole("button", {
      name: "Approve membership",
    })) as HTMLButtonElement;
    fireEvent.click(approveButton);

    const approvingButton = (await within(dialog).findByRole("button", {
      name: "Approving...",
    })) as HTMLButtonElement;
    expect(approvingButton.disabled).toBe(true);

    approved = true;
    deferredStatus.resolve(
      jsonResponse({
        data: {
          ...sampleMembers[1],
          membershipStatus: "VERIFIED",
        },
      }),
    );

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        "Bruce Lee approved and marked as verified.",
        "success",
      );
    });

    expect(
      await screen.findByText(
        "No members match your current search and filter",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Bruce Lee")).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Review payment proof" }),
    ).toBeNull();
  });

  it("declines a Need Review member with a required reason, sends the decline request body, and refreshes the filtered roster", async () => {
    let declined = false;
    const deferredStatus = createDeferred<Response>();

    installFetchMock({
      membersHandler: (url: string) => {
        if (url.includes("status=NEED_REVIEW")) {
          return Promise.resolve(
            membersResponse(
              declined ? [] : [sampleMembers[1]],
              declined
                ? { page: 1, pageSize: 20, total: 0 }
                : { page: 1, pageSize: 20, total: 1 },
            ),
          );
        }

        return Promise.resolve(membersResponse(sampleMembers));
      },
      paymentProofsHandler: () => Promise.resolve(proofMetadataResponse()),
      proofFileHandler: () =>
        Promise.resolve(
          binaryResponse(proofImageBytes, {
            headers: {
              "Content-Type": "image/png",
              "Content-Disposition": 'attachment; filename="receipt.png"',
            },
          }),
        ),
      statusHandler: async (userId, _url, init) => {
        expect(userId).toBe("member-2");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          status: "INACTIVE",
          reason: "Receipt does not show the correct amount.",
        });
        return deferredStatus.promise;
      },
    });

    renderMembersView();
    await screen.findByText("Alice Nguyen");
    fireEvent.click(screen.getByRole("button", { name: "Need Review" }));
    await screen.findByText("Bruce Lee");

    const dialog = await openReviewPaymentDialog();
    expect(
      within(dialog).getByRole("button", { name: "Decline" }),
    ).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Decline" }));

    const reasonInput = await within(dialog).findByLabelText(
      "Decline reason",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm decline" }),
    );

    expect(
      within(dialog).getByText("Enter a decline reason before submitting."),
    ).toBeTruthy();

    fireEvent.change(reasonInput, {
      target: { value: "Receipt does not show the correct amount." },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm decline" }),
    );

    const decliningButton = (await within(dialog).findByRole("button", {
      name: "Declining...",
    })) as HTMLButtonElement;
    expect(decliningButton.disabled).toBe(true);
    const approveButton = within(dialog).getByRole("button", {
      name: "Approve membership",
    }) as HTMLButtonElement;
    expect(approveButton.disabled).toBe(true);

    declined = true;
    deferredStatus.resolve(
      jsonResponse({
        data: {
          ...sampleMembers[1],
          membershipStatus: "INACTIVE",
        },
      }),
    );

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        "Bruce Lee payment proof declined and membership marked inactive.",
        "success",
      );
    });

    expect(
      await screen.findByText(
        "No members match your current search and filter",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Bruce Lee")).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Review payment proof" }),
    ).toBeNull();
  });

  it("refreshes the All roster so an approved member reappears as Verified", async () => {
    let approved = false;

    installFetchMock({
      membersHandler: () =>
        Promise.resolve(
          membersResponse(
            approved
              ? [
                  sampleMembers[0],
                  { ...sampleMembers[1], membershipStatus: "VERIFIED" },
                  sampleMembers[2],
                ]
              : sampleMembers,
          ),
        ),
      paymentProofsHandler: () => Promise.resolve(proofMetadataResponse()),
      proofFileHandler: () =>
        Promise.resolve(
          binaryResponse(proofImageBytes, {
            headers: {
              "Content-Type": "image/png",
              "Content-Disposition": 'attachment; filename="receipt.png"',
            },
          }),
        ),
      statusHandler: () => {
        approved = true;
        return Promise.resolve(
          jsonResponse({
            data: {
              ...sampleMembers[1],
              membershipStatus: "VERIFIED",
            },
          }),
        );
      },
    });

    renderMembersView();
    const dialog = await openReviewPaymentDialog();

    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: "Approve membership",
      }),
    );

    await waitFor(() => {
      const row = screen.getByText("Bruce Lee").closest("tr");
      expect(row).toBeTruthy();
      expect(
        within(row as HTMLTableRowElement).getByText("Verified"),
      ).toBeTruthy();
      expect(
        within(row as HTMLTableRowElement).queryByRole("button", {
          name: "Review payment",
        }),
      ).toBeNull();
    });
  });

  it("refreshes the All roster so a declined member reappears as Inactive", async () => {
    let declined = false;

    installFetchMock({
      membersHandler: () =>
        Promise.resolve(
          membersResponse(
            declined
              ? [
                  sampleMembers[0],
                  { ...sampleMembers[1], membershipStatus: "INACTIVE" },
                  sampleMembers[2],
                ]
              : sampleMembers,
          ),
        ),
      paymentProofsHandler: () => Promise.resolve(proofMetadataResponse()),
      proofFileHandler: () =>
        Promise.resolve(
          binaryResponse(proofImageBytes, {
            headers: {
              "Content-Type": "image/png",
              "Content-Disposition": 'attachment; filename="receipt.png"',
            },
          }),
        ),
      statusHandler: () => {
        declined = true;
        return Promise.resolve(
          jsonResponse({
            data: {
              ...sampleMembers[1],
              membershipStatus: "INACTIVE",
            },
          }),
        );
      },
    });

    renderMembersView();
    const dialog = await openReviewPaymentDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Decline" }));
    fireEvent.change(await within(dialog).findByLabelText("Decline reason"), {
      target: { value: "Receipt is missing the transaction date." },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm decline" }),
    );

    await waitFor(() => {
      const row = screen.getByText("Bruce Lee").closest("tr");
      expect(row).toBeTruthy();
      expect(
        within(row as HTMLTableRowElement).getByText("Inactive"),
      ).toBeTruthy();
      expect(
        within(row as HTMLTableRowElement).queryByRole("button", {
          name: "Review payment",
        }),
      ).toBeNull();
    });
  });

  it("keeps the review modal open and shows an error when approval fails", async () => {
    installFetchMock({
      paymentProofsHandler: () => Promise.resolve(proofMetadataResponse()),
      proofFileHandler: () =>
        Promise.resolve(
          binaryResponse(proofImageBytes, {
            headers: {
              "Content-Type": "image/png",
              "Content-Disposition": 'attachment; filename="receipt.png"',
            },
          }),
        ),
      statusHandler: () =>
        Promise.resolve(
          jsonResponse(
            { error: "Illegal transition: NEED_REVIEW → VERIFIED" },
            409,
          ),
        ),
    });

    renderMembersView();
    const dialog = await openReviewPaymentDialog();

    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: "Approve membership",
      }),
    );

    expect(
      await within(dialog).findByText(
        "Illegal transition: NEED_REVIEW → VERIFIED",
      ),
    ).toBeTruthy();
    expect(showToastMock).toHaveBeenCalledWith(
      "Illegal transition: NEED_REVIEW → VERIFIED",
      "error",
    );
    expect(
      screen.getByRole("dialog", { name: "Review payment proof" }),
    ).toBeTruthy();
  });

  it("keeps the review modal open and shows an error when decline fails", async () => {
    installFetchMock({
      paymentProofsHandler: () => Promise.resolve(proofMetadataResponse()),
      proofFileHandler: () =>
        Promise.resolve(
          binaryResponse(proofImageBytes, {
            headers: {
              "Content-Type": "image/png",
              "Content-Disposition": 'attachment; filename="receipt.png"',
            },
          }),
        ),
      statusHandler: () =>
        Promise.resolve(
          jsonResponse(
            { error: "Decline reason is required for payment proof decline" },
            400,
          ),
        ),
    });

    renderMembersView();
    const dialog = await openReviewPaymentDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Decline" }));
    fireEvent.change(await within(dialog).findByLabelText("Decline reason"), {
      target: { value: "Receipt cannot be verified." },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm decline" }),
    );

    expect(
      await within(dialog).findByText(
        "Decline reason is required for payment proof decline",
      ),
    ).toBeTruthy();
    expect(showToastMock).toHaveBeenCalledWith(
      "Decline reason is required for payment proof decline",
      "error",
    );
    expect(
      screen.getByRole("dialog", { name: "Review payment proof" }),
    ).toBeTruthy();
  });

  it("redirects non-admin users away from the admin page", async () => {
    installFetchMock();
    authState = {
      ...authState,
      isAdmin: false,
      user: {
        ...authState.user,
        role: "USER",
      },
    };

    render(<Admin />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });
    expect(screen.queryByText("Admin Dashboard")).toBeNull();
  });
});
