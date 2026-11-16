import { isCalendarDate } from '../readings/validation.js';

// All arithmetic is on calendar components, never local or UTC midnight instants.
export function reportRange(type, selectedDate) {
  if (!isCalendarDate(selectedDate)) throw new RangeError('Invalid report date.');
  if (type === 'daily') return { startDate: selectedDate, endDate: selectedDate };
  if (type === 'month-to-date') return { startDate: `${selectedDate.slice(0, 7)}-01`, endDate: selectedDate };
  if (type !== 'previous-month') throw new RangeError('Unknown report type.');
  const [year, month] = selectedDate.split('-').map(Number);
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  if (previousYear < 1) throw new RangeError('Previous month must be within year 0001 or later.');
  const prefix = `${String(previousYear).padStart(4, '0')}-${String(previousMonth).padStart(2, '0')}`;
  const lastDay = [31, 30, 29, 28].find((day) => isCalendarDate(`${prefix}-${day}`));
  return { startDate: `${prefix}-01`, endDate: `${prefix}-${lastDay}` };
}
