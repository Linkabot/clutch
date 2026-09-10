// Unit tests for the Zustand app store: initial swStatus is 'registering',
// and setSwStatus updates it. State is reset between tests so the two
// assertions stay independent.
// Depends on: vitest, src/app/store.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/app/store';

const initialState = useAppStore.getState();

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState(initialState, true);
  });

  it('starts with swStatus "registering"', () => {
    expect(useAppStore.getState().swStatus).toBe('registering');
  });

  it('updates swStatus when setSwStatus is called', () => {
    useAppStore.getState().setSwStatus('ready');
    expect(useAppStore.getState().swStatus).toBe('ready');
  });
});
