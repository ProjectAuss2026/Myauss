import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

afterEach(cleanup);

describe('Footer legal links', () => {
  it('links to the Privacy Policy without showing unused legal or social links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(privacyLink.getAttribute('href')).toBe('/privacy');
    expect(screen.queryByText('Terms of Service')).toBeNull();
    ['LinkedIn', 'Facebook', 'Instagram', 'TikTok', 'Discord', 'Email'].forEach(
      (label) => {
        expect(screen.queryByRole('link', { name: label })).toBeNull();
      },
    );
  });
});
