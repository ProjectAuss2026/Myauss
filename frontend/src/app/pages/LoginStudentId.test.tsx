import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Login } from './Login';

const fetchMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderRegistration() {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));
  await screen.findByRole('heading', { name: 'Member Registration' });
}

describe('registration optional student ID', () => {
  it('shows the client-approved membership declaration as a second required checkbox', async () => {
    await renderRegistration();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[1]).toBe(
      screen.getByRole('checkbox', {
        name: /I agree, by entering my name, to be a member of Auckland University Strength Society Incorporated/i,
      }),
    );
    expect(checkboxes[1].hasAttribute('required')).toBe(true);
    expect(checkboxes[1].getAttribute('aria-required')).toBe('true');
  });

  it('uses a required Privacy Policy link and does not show Terms of Service', async () => {
    await renderRegistration();

    const privacyCheckbox = screen.getByRole('checkbox', {
      name: /I agree to the AUSS Privacy Policy/i,
    });
    expect(privacyCheckbox.hasAttribute('required')).toBe(true);
    expect(screen.queryByText(/Terms of Service/i)).toBeNull();

    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(privacyLink.getAttribute('href')).toBe('/privacy');
    expect(privacyLink.getAttribute('target')).toBe('_blank');
    expect(privacyLink.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('uses inclusive labels and removes the required Student ID state', async () => {
    await renderRegistration();

    expect(screen.queryByText('University Email')).toBeNull();
    expect(screen.getByText('University email preferred.')).toBeTruthy();
    const studentId = screen.getByLabelText('Student ID (optional)');
    expect(studentId.getAttribute('aria-required')).toBeNull();
    expect(screen.getByText(/Non-UoA members can leave this blank/)).toBeTruthy();
  });

  it('submits null when Student ID is left blank', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'If your email is eligible, a verification code has been sent.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await renderRegistration();

    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Member' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Create a password'), {
      target: { value: 'CorrectHorseBatteryStaple!2026' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm your password'), {
      target: { value: 'CorrectHorseBatteryStaple!2026' },
    });
    fireEvent.click(screen.getByLabelText(/I agree to the AUSS Privacy Policy/));
    fireEvent.click(screen.getByLabelText(/I agree, by entering my name/));
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.studentId).toBeNull();
    expect(body.privacyPolicyAccepted).toBe(true);
    expect(body.membershipAgreementAccepted).toBe(true);
  });
});
