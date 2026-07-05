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

function getRequestParams(url: string): URLSearchParams {
  return new URL(url, "http://localhost").searchParams;
}

function installFetchMock(
  options: {
    membersHandler?: (url: string) => Promise<Response> | Response;
  } = {},
) {
  fetchMock.mockImplementation((input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith("/api/auth/admin/members")) {
      if (options.membersHandler) {
        return options.membersHandler(url);
      }
      return Promise.resolve(membersResponse(sampleMembers));
    }

    switch (url) {
      case "/api/sponsorship":
        return Promise.resolve(jsonResponse({ data: { id: 1, sponsors: [] } }));
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
  });
}

function renderMembersView() {
  localStorage.setItem("admin_tab", "members");
  return render(<Admin />);
}

beforeEach(() => {
  localStorage.clear();
  navigateMock.mockReset();
  logoutMock.mockReset();
  showToastMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
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
      expect(membersHandler).toHaveBeenCalledWith(
        expect.stringContaining("search=alice"),
      );
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
    expect(membersHandler).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Alice Nguyen")).toBeTruthy();
    expect(membersHandler).toHaveBeenCalledWith(
      expect.stringContaining("page=1"),
    );
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
      expect(membersHandler).toHaveBeenCalledWith(
        expect.stringContaining("pageSize=50"),
      );
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
