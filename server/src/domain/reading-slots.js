import { z } from 'zod';

export const READING_SLOTS = Object.freeze([
  'morning_fasting',
  'after_breakfast',
  'after_lunch',
  'after_dinner',
]);

export const readingSlotSchema = z.enum(READING_SLOTS);

