// Barrel module re-exporting every UI primitive, so callers can write
// `import { Button, Chip, ... } from '../../ui'` without knowing the file
// layout inside src/ui/.
// Depends on: ./SignPanel, ./SignPlate, ./Roundel, ./Button, ./Chip.
// Depended on by: tests/unit/ui.test.ts and app screens across src/features/
// (e.g. Roundel in src/features/practice/PracticeScreen.tsx, Button and
// Chip in several games and Highway Code screens).
export { default as SignPanel } from './SignPanel';
export { default as SignPlate } from './SignPlate';
export { default as Roundel } from './Roundel';
export { default as Button } from './Button';
export { default as Chip } from './Chip';
