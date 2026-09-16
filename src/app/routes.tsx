// Router configuration: a single layout route (App) wrapping the five tab
// screens, addressed by their paths from TABS, plus the Highway Code
// sections list, section screen, search screen and single-rule deep link
// nested under Learn (the rule route lives at /code/rule/:id, not
// /learn/code/rule/:id, so it also matches Step 5's
// alsoActiveFor: ['/code'] Learn-tab highlighting), and (Step 19) the
// Signs browser at /learn/signs. The static learn/code/search and
// learn/signs routes are listed before the learn/code/:slug param route so
// the intent is obvious to a reader, though React Router ranks static
// segments higher regardless of source order.
// Depends on: react-router-dom, ./App, ./tabs, src/features/*/*.tsx,
// src/features/code/HighwayCodeSectionsScreen, src/features/code/SectionScreen,
// src/features/code/SearchScreen, src/features/code/RuleScreen,
// src/features/signs/SignsScreen.
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
import SearchScreen from '../features/code/SearchScreen';
import RuleScreen from '../features/code/RuleScreen';
import SignsScreen from '../features/signs/SignsScreen';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <JourneyScreen /> },
        { path: 'learn', element: <LearnScreen /> },
        { path: 'learn/code', element: <HighwayCodeSectionsScreen /> },
        { path: 'learn/code/search', element: <SearchScreen /> },
        { path: 'learn/signs', element: <SignsScreen /> },
        { path: 'learn/code/:slug', element: <SectionScreen /> },
        { path: 'code/rule/:id', element: <RuleScreen /> },
        { path: 'practice', element: <PracticeScreen /> },
        { path: 'my-car', element: <MyCarScreen /> },
        { path: 'me', element: <MeScreen /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
