import type { TrainingSession } from '../domain/session';

export const INITIAL_MOCK_SESSIONS: TrainingSession[] = [
  {
    id: 'session-1',
    title: 'Onboarding: Accelerator Workflow',
    status: 'scheduled',
    startAt: '2026-09-20T10:00:00.000Z',
  },
  {
    id: 'session-2',
    title: 'React Testing Library Deep Dive',
    status: 'completed',
    startAt: '2026-08-01T14:00:00.000Z',
  },
  {
    id: 'session-3',
    title: 'Cancelled: TypeScript Migration Workshop',
    status: 'cancelled',
    startAt: '2026-08-15T09:00:00.000Z',
  },
];
