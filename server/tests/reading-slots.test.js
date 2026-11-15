import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  READING_SLOTS,
  readingSlotSchema,
} from '../src/domain/reading-slots.js';

describe('reading slots', () => {
  it('permits exactly the four slots in specification order', () => {
    const expectedSlots = [
      'morning_fasting',
      'after_breakfast',
      'after_lunch',
      'after_dinner',
    ];

    assert.deepEqual(READING_SLOTS, expectedSlots);
    assert.equal(READING_SLOTS.length, 4);

    for (const slot of expectedSlots) {
      assert.equal(readingSlotSchema.safeParse(slot).success, true);
    }
  });

  it('rejects snacks and every unrecognized fifth slot', () => {
    const invalidSlots = ['snacks', 'bedtime', 'after_snacks', ''];

    for (const slot of invalidSlots) {
      assert.equal(readingSlotSchema.safeParse(slot).success, false);
    }
  });
});

