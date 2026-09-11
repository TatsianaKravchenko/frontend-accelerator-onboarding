import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionStatus, TrainingSession } from '../domain/session';
import { fetchSessions } from '../api/sessionsClient';

type ListStatus = 'idle' | 'loading' | 'error' | 'success';

export type SessionFilter = SessionStatus | 'all';

export function useSessionsList() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [status, setStatus] = useState<ListStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SessionFilter>('all');
  const latestRequestId = useRef(0);

  const load = useCallback(() => {
    const requestId = ++latestRequestId.current;
    setStatus('loading');
    setError(null);

    fetchSessions().then(
      (result) => {
        if (latestRequestId.current !== requestId) {
          return;
        }
        setSessions(result);
        setStatus('success');
      },
      (err: unknown) => {
        if (latestRequestId.current !== requestId) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load training sessions.');
        setStatus('error');
      },
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSessions = useMemo(
    () => (filter === 'all' ? sessions : sessions.filter((session) => session.status === filter)),
    [sessions, filter],
  );

  const addSession = useCallback((session: TrainingSession) => {
    setSessions((current) => [...current, session]);
  }, []);

  return {
    status,
    error,
    filter,
    setFilter,
    filteredSessions,
    retry: load,
    addSession,
  };
}
