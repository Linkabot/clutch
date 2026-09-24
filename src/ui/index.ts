// Barrel module re-exporting five of the eight UI primitives in src/ui/, so
// callers can write `import { Button, Chip, ... } from '../../ui'` without
// knowing the file layout inside src/ui/. ListRow, SegmentedControl and
// LoadFailed sit deliberately outside this barrel and are imported straight
// from their own files instead (see each one's own header).
// Depends on: ./SignPanel, ./SignPlate, ./Roundel, ./Button, ./Chip.
// Depended on by: tests/unit/ui.test.ts and app screens across src/features/
// (e.g. Roundel in src/features/practice/PracticeScreen.tsx, Button and
// Chip in several games and Highway Code screens), src/app/AddToHomeScreen.tsx.
export { default as SignPanel } from './SignPanel';
export { default as SignPlate } from './SignPlate';
export { default as Roundel } from './Roundel';
export { default as Button } from './Button';
export { default as Chip } from './Chip';
