import { RouterProvider } from 'react-router-dom';
import { ErrorButton } from './components/ErrorButton';
import { router } from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

const showSentryTestButton = import.meta.env.DEV
  || import.meta.env.VITE_ENABLE_SENTRY_TEST_BUTTON === 'true';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        {showSentryTestButton && <ErrorButton />}
      </AuthProvider>
    </ToastProvider>
  );
}
