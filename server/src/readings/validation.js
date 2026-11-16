import { z } from 'zod';
import { readingSlotSchema } from '../domain/reading-slots.js';

// Validate calendar components directly: no parsing date-only input as UTC/local instants.
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export function dateInTimeZone(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const part = (type) => parts.find((value) => value.type === type).value;
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}

export function readingSchemas(today) {
  const date = z.string().refine(isCalendarDate, 'Use a real date in YYYY-MM-DD format.')
    .refine((value) => !isCalendarDate(value) || value <= today, 'Date must not be in the future.');
  return {
    body: z.object({ date, slot: readingSlotSchema, valueMgDl: z.number().int().min(40).max(600) }).strict(),
    query: z.object({ date }).strict(),
  };
}

export const readingIdSchema = z.string().regex(/^[1-9]\d*$/)
  .refine((value) => Number(value) <= 2147483647, 'Invalid reading ID.');

export function validationError(error) {
  const fields = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === 'valueMgDl') fields.valueMgDl = 'Glucose value is required and must be a whole number from 40 to 600 mg/dL.';
    else if (field === 'slot') fields.slot = 'Choose morning_fasting, after_breakfast, after_lunch or after_dinner.';
    else if (field === 'date') fields.date = issue.code === 'custom' ? issue.message : 'Date is required in YYYY-MM-DD format.';
    else fields.request = 'Only the documented reading fields are accepted.';
  }
  return { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields };
}
