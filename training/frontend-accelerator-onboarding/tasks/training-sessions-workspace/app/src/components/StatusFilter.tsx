import { SESSION_STATUSES } from '../domain/session';
import type { SessionFilter } from '../hooks/useSessionsList';

interface StatusFilterProps {
  value: SessionFilter;
  onChange: (value: SessionFilter) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <label>
      Status
      <select
        aria-label="Filter sessions by status"
        value={value}
        onChange={(event) => onChange(event.target.value as SessionFilter)}
      >
        <option value="all">All</option>
        {SESSION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </label>
  );
}
