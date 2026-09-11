import type { TrainingSession } from '../domain/session';

interface SessionsListProps {
  status: 'idle' | 'loading' | 'error' | 'success';
  error: string | null;
  sessions: TrainingSession[];
  onRetry: () => void;
}

export function SessionsList({ status, error, sessions, onRetry }: SessionsListProps) {
  if (status === 'loading' || status === 'idle') {
    return <p role="status">Loading training sessions…</p>;
  }

  if (status === 'error') {
    return (
      <div role="alert">
        <p>{error ?? 'Failed to load training sessions.'}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return <p>No training sessions match this filter.</p>;
  }

  return (
    <ul aria-label="Training sessions">
      {sessions.map((session) => (
        <li key={session.id}>
          <span>{session.title}</span>
          <span>{session.status}</span>
          <time dateTime={session.startAt}>{new Date(session.startAt).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
}
