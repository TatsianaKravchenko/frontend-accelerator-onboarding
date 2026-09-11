export type ValidationResult = { valid: true } | { valid: false; message: string };

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 80;

export function validateTitle(rawTitle: string): ValidationResult {
  const title = rawTitle.trim();

  if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    return {
      valid: false,
      message: `Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
    };
  }

  return { valid: true };
}

export function validateStartAt(rawStartAt: string, now: Date = new Date()): ValidationResult {
  if (!rawStartAt) {
    return { valid: false, message: 'Date and time are required.' };
  }

  const startAt = new Date(rawStartAt);

  if (Number.isNaN(startAt.getTime())) {
    return { valid: false, message: 'Date and time must be valid.' };
  }

  if (startAt.getTime() <= now.getTime()) {
    return { valid: false, message: 'Date and time must be in the future.' };
  }

  return { valid: true };
}
