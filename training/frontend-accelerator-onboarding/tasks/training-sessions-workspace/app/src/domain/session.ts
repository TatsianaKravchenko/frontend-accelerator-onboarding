export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export const SESSION_STATUSES: SessionStatus[] = ['scheduled', 'completed', 'cancelled'];

export interface TrainingSession {
  id: string;
  title: string;
  status: SessionStatus;
  startAt: string;
}
