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
    fireEvent.click(screen.getByLabelText(/I agree to the/));
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init.body)).studentId).toBeNull();
  });
});
