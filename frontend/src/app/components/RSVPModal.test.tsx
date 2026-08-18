import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RSVPModal } from './RSVPModal';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RSVPModal optional student ID', () => {
  it('submits null when Student ID is left blank', async () => {
    const onSuccess = vi.fn();
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));

    render(
      <RSVPModal
        open
        activityId={42}
        activityTitle="Welcome Night"
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Your full name'), {
      target: { value: 'Alex Member' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit RSVP' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Alex Member',
      email: 'alex@example.com',
      studentId: null,
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('labels Student ID as optional and describes its use', () => {
    render(
      <RSVPModal open activityId={42} onClose={vi.fn()} />,
    );

    const input = screen.getByLabelText('Student ID (optional)');
    expect(input.getAttribute('aria-required')).toBeNull();
    expect(screen.getByText(/Non-UoA members can leave this blank/)).toBeTruthy();
  });
});
