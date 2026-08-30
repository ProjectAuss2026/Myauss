import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Originally added in #59 to cover the optional-student-ID form. KAN-178 made
// events members-only: the modal no longer collects any fields — the booking is
// taken from the account — so these cover the gated states instead.

const navigateMock = vi.fn();
const fetchWithAuthMock = vi.fn();
let mockAuth: { user: unknown; isAdmin: boolean } = { user: null, isAdmin: false };

vi.mock('react-router', () => ({ useNavigate: () => navigateMock }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
vi.mock('../lib/authFetch', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const { RSVPModal } = await import('./RSVPModal');

const verifiedUser = {
  email: 'alex@example.com',
  firstName: 'Alex',
  lastName: 'Member',
  membershipStatus: 'VERIFIED',
};

beforeEach(() => {
  navigateMock.mockReset();
  fetchWithAuthMock.mockReset();
  mockAuth = { user: null, isAdmin: false };
});

afterEach(() => {
  cleanup();
});

function open() {
  render(<RSVPModal open activityId={42} activityTitle="Welcome Night" onClose={vi.fn()} />);
}

describe('RSVPModal — members-only gating (KAN-178)', () => {
  it('prompts a signed-out visitor to sign in, with no form fields', () => {
    open();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    // The old typed-in form must not come back — details come from the account.
    expect(screen.queryByPlaceholderText('Your full name')).toBeNull();
    expect(screen.queryByPlaceholderText('you@example.com')).toBeNull();
    expect(screen.queryByText(/Student ID/i)).toBeNull();
  });

  it('sends a signed-out visitor to the login page', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('shows the membership CTA for a signed-in member who has not paid', () => {
    mockAuth = { user: { ...verifiedUser, membershipStatus: 'INACTIVE' }, isAdmin: false };
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Activate membership' }));
    expect(navigateMock).toHaveBeenCalledWith('/verify-membership');
  });

  it('lets an ADMIN book even when their own membership is inactive', () => {
    // Mirrors requireVerifiedMembership's server-side exemption: staff run
    // events and must not be blocked by their own membership state.
    mockAuth = { user: { ...verifiedUser, membershipStatus: 'INACTIVE' }, isAdmin: true };
    open();
    expect(screen.getByRole('button', { name: /Confirm RSVP/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate membership' })).toBeNull();
  });

  it('shows the account details read-only and posts no body', async () => {
    mockAuth = { user: verifiedUser, isAdmin: false };
    fetchWithAuthMock.mockResolvedValue(new Response('{}', { status: 201 }));
    open();

    expect(screen.getByText('Alex Member')).toBeTruthy();
    expect(screen.getByText('alex@example.com')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Confirm RSVP/ }));

    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchWithAuthMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/activities/42/rsvp');
    expect(init.method).toBe('POST');
    // Attendee details are server-sourced — nothing is sent from the client.
    expect(init.body).toBeUndefined();
  });

  it('surfaces a membership rejection using the machine-readable code', async () => {
    mockAuth = { user: verifiedUser, isAdmin: false };
    fetchWithAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'MEMBERSHIP_REQUIRED' }), { status: 403 }),
    );
    open();

    fireEvent.click(screen.getByRole('button', { name: /Confirm RSVP/ }));

    await waitFor(() =>
      expect(screen.getByText(/active AUSS membership is required/i)).toBeTruthy(),
    );
  });
});
