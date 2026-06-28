import { createBrowserRouter } from 'react-router-dom';
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
import { Profile } from './pages/Profile';
import { ManageLinks } from './pages/ManageLinks';
import { Admin } from './pages/Admin';
import { Sponsorship } from './pages/Sponsorship';
import { Activities } from './pages/Activities';
import { ActivityDetails } from './pages/ActivityDetails';
import { MediaGallery } from './pages/MediaGallery';
import { MembershipPayment } from './pages/MembershipPayment';

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
      { path: 'profile', Component: Profile },
      { path: 'activities', Component: Activities },
      { path: 'activities/:id', Component: ActivityDetails },
      { path: 'media', Component: MediaGallery },
      { path: 'membership/pay', Component: MembershipPayment },
      { path: 'manage', Component: ManageLinks },
      { path: 'admin', Component: Admin },
      { path: '*', Component: NotFound },
    ],
  },
]);
