import type { TrainingSession } from '../domain/session';
import { INITIAL_MOCK_SESSIONS } from './mockSessions';

interface MockApiConfig {
  shouldFail: boolean;
  delayMs: number;
}

const DEFAULT_CONFIG: MockApiConfig = { shouldFail: false, delayMs: 10 };

let config: MockApiConfig = { ...DEFAULT_CONFIG };
let sessions: TrainingSession[] = [...INITIAL_MOCK_SESSIONS];
let nextSessionNumber = sessions.length + 1;

export function configureMockApi(overrides: Partial<MockApiConfig>): void {
  config = { ...config, ...overrides };
}

export function resetMockApi(): void {
  config = { ...DEFAULT_CONFIG };
  sessions = [...INITIAL_MOCK_SESSIONS];
  nextSessionNumber = sessions.length + 1;
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, config.delayMs));
}

export async function fetchSessions(): Promise<TrainingSession[]> {
  await delay();

  if (config.shouldFail) {
    throw new Error('Failed to load training sessions.');
  }

  return [...sessions];
}

export async function createSession(input: {
  title: string;
  startAt: string;
}): Promise<TrainingSession> {
  await delay();

  if (config.shouldFail) {
    throw new Error('Failed to create the training session.');
  }

  const created: TrainingSession = {
    id: `session-${nextSessionNumber++}`,
    title: input.title.trim(),
    status: 'scheduled',
    startAt: input.startAt,
  };

  sessions = [...sessions, created];

  return created;
}
