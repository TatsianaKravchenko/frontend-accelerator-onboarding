import { useState, type FormEvent } from 'react';

interface CreateSessionFormProps {
  pending: boolean;
  error: string | null;
  onSubmit: (input: { title: string; startAt: string }) => void;
}

export function CreateSessionForm({ pending, error, onSubmit }: CreateSessionFormProps) {
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ title, startAt });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="session-title">Title</label>
      <input
        id="session-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <label htmlFor="session-start-at">Date and time</label>
      <input
        id="session-start-at"
        type="datetime-local"
        value={startAt}
        onChange={(event) => setStartAt(event.target.value)}
      />

      {error ? <p role="alert">{error}</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create session'}
      </button>
    </form>
  );
}
