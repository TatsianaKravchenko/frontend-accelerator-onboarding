import { useState } from 'react';
import { useSessionsList } from '../hooks/useSessionsList';
import { useCreateSession } from '../hooks/useCreateSession';
import { StatusFilter } from './StatusFilter';
import { SessionsList } from './SessionsList';
import { CreateSessionForm } from './CreateSessionForm';

export function SessionsWorkspace() {
  const { status, error, filter, setFilter, filteredSessions, retry, addSession } = useSessionsList();
  const { status: createStatus, error: createError, submit } = useCreateSession();
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

  async function handleCreate(input: { title: string; startAt: string }) {
    const created = await submit(input);
    if (created) {
      addSession(created);
      setIsCreateFormOpen(false);
    }
  }

  return (
    <section>
      <h1>Training Sessions</h1>

      <StatusFilter value={filter} onChange={setFilter} />

      <SessionsList status={status} error={error} sessions={filteredSessions} onRetry={retry} />

      {isCreateFormOpen ? (
        <CreateSessionForm
          pending={createStatus === 'submitting'}
          error={createStatus === 'error' ? createError : null}
          onSubmit={handleCreate}
        />
      ) : (
        <button type="button" onClick={() => setIsCreateFormOpen(true)}>
          New session
        </button>
      )}
    </section>
  );
}
