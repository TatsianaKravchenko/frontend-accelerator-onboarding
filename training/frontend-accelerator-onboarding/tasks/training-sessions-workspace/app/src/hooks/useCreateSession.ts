import { useCallback, useState } from 'react';
import type { TrainingSession } from '../domain/session';
import { createSession } from '../api/sessionsClient';
import { validateStartAt, validateTitle } from '../domain/validation';

type CreateStatus = 'idle' | 'submitting' | 'error';

export function useCreateSession() {
  const [status, setStatus] = useState<CreateStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (input: { title: string; startAt: string }): Promise<TrainingSession | undefined> => {
      if (status === 'submitting') {
        return undefined;
      }

      const titleResult = validateTitle(input.title);
      if (!titleResult.valid) {
        setError(titleResult.message);
        setStatus('error');
        return undefined;
      }

      const startAtResult = validateStartAt(input.startAt);
      if (!startAtResult.valid) {
        setError(startAtResult.message);
        setStatus('error');
        return undefined;
      }

      setStatus('submitting');
      setError(null);

      try {
        const created = await createSession({ title: input.title.trim(), startAt: input.startAt });
        setStatus('idle');
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create the training session.');
        setStatus('error');
        return undefined;
      }
    },
    [status],
  );

  return { status, error, submit };
}
