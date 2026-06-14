import * as Sentry from '@sentry/react';

export function ErrorButton() {
  return (
    <button
      type="button"
      data-testid="sentry-error-button"
      className="fixed bottom-4 right-4 z-50 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-300"
      onClick={() => {
        const error = new Error('This is your first error!');

        Sentry.addBreadcrumb({
          category: 'sentry-test',
          level: 'info',
          message: 'Sentry test error button clicked',
        });
        Sentry.captureException(error);
        void Sentry.flush(2000).finally(() => {
          setTimeout(() => {
            throw error;
          }, 0);
        });
      }}
    >
      Break the world
    </button>
  );
}
