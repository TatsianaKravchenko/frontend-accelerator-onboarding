import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionsWorkspace } from './SessionsWorkspace';
import { resetMockApi } from '../api/sessionsClient';
import { INITIAL_MOCK_SESSIONS } from '../api/mockSessions';

beforeEach(() => {
  resetMockApi();
});

describe('SessionsWorkspace', () => {
  it('creates a session and shows it in the list', async () => {
    const user = userEvent.setup();
    render(<SessionsWorkspace />);

    await screen.findByText(INITIAL_MOCK_SESSIONS[0].title);

    await user.click(screen.getByRole('button', { name: 'New session' }));

    await user.type(screen.getByLabelText('Title'), 'Vitest Fundamentals');
    const startAtInput = screen.getByLabelText('Date and time');
    await user.type(startAtInput, '2999-06-01T10:00');

    await user.click(screen.getByRole('button', { name: 'Create session' }));

    expect(await screen.findByText('Vitest Fundamentals')).toBeInTheDocument();
  });

  it('filters sessions by status and back to all', async () => {
    const user = userEvent.setup();
    render(<SessionsWorkspace />);

    await screen.findByText(INITIAL_MOCK_SESSIONS[0].title);

    const completedSession = INITIAL_MOCK_SESSIONS.find((session) => session.status === 'completed')!;
    const scheduledSession = INITIAL_MOCK_SESSIONS.find((session) => session.status === 'scheduled')!;

    await user.selectOptions(
      screen.getByLabelText('Filter sessions by status'),
      completedSession.status,
    );

    expect(screen.getByText(completedSession.title)).toBeInTheDocument();
    expect(screen.queryByText(scheduledSession.title)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter sessions by status'), 'all');

    expect(screen.getByText(completedSession.title)).toBeInTheDocument();
    expect(screen.getByText(scheduledSession.title)).toBeInTheDocument();
  });
});
