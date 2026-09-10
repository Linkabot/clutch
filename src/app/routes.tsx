// Router configuration: a single layout route (App) wrapping the five tab
// screens, addressed by their paths from TABS.
// Depends on: react-router-dom, ./App, ./tabs, src/features/*/*.tsx.
// Depended on by: src/main.tsx.
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import JourneyScreen from '../features/journey/JourneyScreen';
import LearnScreen from '../features/learn/LearnScreen';
import PracticeScreen from '../features/practice/PracticeScreen';
import MyCarScreen from '../features/my-car/MyCarScreen';
import MeScreen from '../features/me/MeScreen';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <JourneyScreen /> },
        { path: 'learn', element: <LearnScreen /> },
        { path: 'practice', element: <PracticeScreen /> },
        { path: 'my-car', element: <MyCarScreen /> },
        { path: 'me', element: <MeScreen /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
