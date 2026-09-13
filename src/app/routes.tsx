// Router configuration: a single layout route (App) wrapping the five tab
// screens, addressed by their paths from TABS, plus the Highway Code
// sections list and section screen nested under Learn.
// Depends on: react-router-dom, ./App, ./tabs, src/features/*/*.tsx,
// src/features/code/HighwayCodeSectionsScreen, src/features/code/SectionScreen.
// Depended on by: src/main.tsx.
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import JourneyScreen from '../features/journey/JourneyScreen';
import LearnScreen from '../features/learn/LearnScreen';
import PracticeScreen from '../features/practice/PracticeScreen';
import MyCarScreen from '../features/my-car/MyCarScreen';
import MeScreen from '../features/me/MeScreen';
import HighwayCodeSectionsScreen from '../features/code/HighwayCodeSectionsScreen';
import SectionScreen from '../features/code/SectionScreen';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <JourneyScreen /> },
        { path: 'learn', element: <LearnScreen /> },
        { path: 'learn/code', element: <HighwayCodeSectionsScreen /> },
        { path: 'learn/code/:slug', element: <SectionScreen /> },
        { path: 'practice', element: <PracticeScreen /> },
        { path: 'my-car', element: <MyCarScreen /> },
        { path: 'me', element: <MeScreen /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
