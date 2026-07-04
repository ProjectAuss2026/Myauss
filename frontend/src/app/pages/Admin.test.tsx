import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Admin } from './Admin';

const navigateMock = vi.fn();
const logoutMock = vi.fn();
const showToastMock = vi.fn();
const fetchMock = vi.fn();

let authState = {
  user: {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'ADMIN',
    firstName: 'Admin',
    lastName: 'User',
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
    id: 'member-1',
    email: 'alice@example.com',
    role: 'USER',
    firstName: 'Alice',
    lastName: 'Nguyen',
    studentId: '123456789',
    createdAt: '2026-05-01T12:00:00.000Z',
    membershipStatus: 'VERIFIED',
  },
  {
    id: 'member-2',
    email: 'bruce@example.com',
    role: 'ADMIN',
    firstName: 'Bruce',
    lastName: 'Lee',
    studentId: null,
    createdAt: '2026-05-03T12:00:00.000Z',
    membershipStatus: 'NEED_REVIEW',
  },
  {
    id: 'member-3',
    email: 'charlie@example.com',
    role: 'USER',
    fullName: 'Charlie Kim',
    studentId: '555111222',
    createdAt: '2026-05-04T12:00:00.000Z',
    membershipStatus: 'INACTIVE',
  },
];

function installFetchMock(options: {
  membersHandler?: (url: string) => Promise<Response> | Response;
} = {}) {
  fetchMock.mockImplementation((input: string | URL | Request) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    if (url.startsWith('/api/auth/admin/members')) {
      if (options.membersHandler) {
        return options.membersHandler(url);
      }
      return Promise.resolve(jsonResponse({ data: sampleMembers }));
    }

    switch (url) {
      case '/api/sponsorship':
        return Promise.resolve(jsonResponse({ data: { id: 1, sponsors: [] } }));
      case '/api/media-entries':
        return Promise.resolve(jsonResponse({ data: [] }));
      case '/api/activities/all':
        return Promise.resolve(jsonResponse([]));
      case '/api/admin/executives':
      case '/api/admin/exec-roles':
      case '/api/admin/exec-teams':
      case '/api/admin/faq':
        return Promise.resolve(jsonResponse({ data: [] }));
      default:
        return Promise.resolve(jsonResponse({}));
    }
  });
}

function renderMembersView() {
  localStorage.setItem('admin_tab', 'members');
  return render(<Admin />);
}

beforeEach(() => {
  localStorage.clear();
  navigateMock.mockReset();
  logoutMock.mockReset();
  showToastMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState = {
    user: {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
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
  vi.unstubAllGlobals();
});

describe('Admin membership roster', () => {
  it('renders the members tab heading and filter controls', async () => {
    installFetchMock();

    renderMembersView();

    expect(screen.getByRole('button', { name: 'Members' })).toBeTruthy();
    expect(await screen.findByText('Membership Roster')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search by name, email, or student ID')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Inactive' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Need Review' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verified' })).toBeTruthy();
  });

  it('shows members returned from the API in the table with status badges', async () => {
    installFetchMock();

    renderMembersView();

    const aliceRow = await screen.findByText('Alice Nguyen');
    expect(aliceRow).toBeTruthy();
    expect(screen.getByText('bruce@example.com')).toBeTruthy();
    expect(screen.getByText('Charlie Kim')).toBeTruthy();

    const verifiedRow = aliceRow.closest('tr');
    expect(verifiedRow).toBeTruthy();
    expect(within(verifiedRow as HTMLTableRowElement).getByText('Verified')).toBeTruthy();

    const reviewRow = screen.getByText('Bruce Lee').closest('tr');
    expect(reviewRow).toBeTruthy();
    expect(within(reviewRow as HTMLTableRowElement).getByText('Need Review')).toBeTruthy();
  });

  it('filters members by name, email, and student ID', async () => {
    installFetchMock();

    renderMembersView();

    const searchInput = await screen.findByPlaceholderText('Search by name, email, or student ID');

    fireEvent.change(searchInput, { target: { value: 'alice' } });
    expect(screen.getByText('Alice Nguyen')).toBeTruthy();
    expect(screen.queryByText('Bruce Lee')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'bruce@example.com' } });
    expect(screen.getByText('Bruce Lee')).toBeTruthy();
    expect(screen.queryByText('Alice Nguyen')).toBeNull();

    fireEvent.change(searchInput, { target: { value: '555111222' } });
    expect(screen.getByText('Charlie Kim')).toBeTruthy();
    expect(screen.queryByText('Bruce Lee')).toBeNull();
  });

  it('calls the roster endpoint with the selected status filter', async () => {
    const membersHandler = vi.fn((url: string) => {
      if (url.includes('status=VERIFIED')) {
        return Promise.resolve(jsonResponse({ data: [sampleMembers[0]] }));
      }
      return Promise.resolve(jsonResponse({ data: sampleMembers }));
    });
    installFetchMock({ membersHandler });

    renderMembersView();

    await screen.findByText('Alice Nguyen');
    fireEvent.click(screen.getByRole('button', { name: 'Verified' }));

    await waitFor(() => {
      expect(membersHandler).toHaveBeenCalledWith(expect.stringContaining('status=VERIFIED'));
    });
    await waitFor(() => {
      expect(screen.queryByText('Bruce Lee')).toBeNull();
    });
  });

  it('shows a loading state while the roster is being fetched', async () => {
    const deferredMembers = createDeferred<Response>();
    installFetchMock({
      membersHandler: () => deferredMembers.promise,
    });

    renderMembersView();

    expect(await screen.findByText('Loading member roster...')).toBeTruthy();

    deferredMembers.resolve(jsonResponse({ data: sampleMembers }));
    await screen.findByText('Alice Nguyen');
  });

  it('shows an error state when the roster request fails', async () => {
    installFetchMock({
      membersHandler: () => Promise.resolve(jsonResponse({ error: 'Roster unavailable' }, 500)),
    });

    renderMembersView();

    expect(await screen.findByText('Roster unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows empty and no-results states when appropriate', async () => {
    installFetchMock({
      membersHandler: () => Promise.resolve(jsonResponse({ data: [] })),
    });

    renderMembersView();
    expect(await screen.findByText('No registered members yet')).toBeTruthy();

    cleanup();
    fetchMock.mockReset();
    installFetchMock();

    renderMembersView();
    const searchInput = await screen.findByPlaceholderText('Search by name, email, or student ID');
    fireEvent.change(searchInput, { target: { value: 'does-not-exist' } });

    expect(await screen.findByText('No members match your current search and filter')).toBeTruthy();
  });

  it('redirects non-admin users away from the admin page', async () => {
    installFetchMock();
    authState = {
      ...authState,
      isAdmin: false,
      user: {
        ...authState.user,
        role: 'USER',
      },
    };

    render(<Admin />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
    });
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
  });
});