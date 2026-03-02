import { createBrowserRouter } from 'react-router-dom';
import { Root } from './pages/Root';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Social } from './pages/Social';
import { MeetTheExecs } from './pages/MeetTheExecs';
import { NotFound } from './pages/NotFound';
import { Login } from './pages/Login';
import { Sponsorship } from './pages/Sponsorship';

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
      { path: '*', Component: NotFound },
    ],
  },
]);
