import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Root } from './pages/Root';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Social } from './pages/Social';
import { MeetTheExecs } from './pages/MeetTheExecs';
import { NotFound } from './pages/NotFound';
import { Login } from './pages/Login';
import { Verify } from './pages/Verify';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { MemberDashboard } from './pages/MemberDashboard';
import { ManageLinks } from './pages/ManageLinks';
import { Admin } from './pages/Admin';
import { Sponsorship } from './pages/Sponsorship';
import { Activities } from './pages/Activities';
import { ActivityDetails } from './pages/ActivityDetails';
import { ActivateMembership } from './pages/ActivateMembership';
import { MediaGallery } from './pages/MediaGallery';
import { Privacy } from './pages/Privacy';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: 'about', Component: About },
      { path: 'sponsorship', Component: Sponsorship },
      { path: 'social', Component: Social },
      { path: 'meet-the-execs', Component: MeetTheExecs },
      { path: 'login', Component: Login },
      { path: 'verify', Component: Verify },
      { path: 'forgot-password', Component: ForgotPassword },
      { path: 'reset', Component: ResetPassword },
      { path: 'dashboard', Component: MemberDashboard },
      { path: 'activities', Component: Activities },
      { path: 'activities/:id', Component: ActivityDetails },
      { path: 'media', Component: MediaGallery },
      { path: 'privacy', Component: Privacy },
      { path: 'verify-membership', Component: ActivateMembership },
      { path: 'membership/pay', Component: () => <Navigate to="/verify-membership" replace /> },
      { path: 'manage', Component: ManageLinks },
      { path: 'admin', Component: Admin },
      { path: '*', Component: NotFound },
    ],
  },
]);
