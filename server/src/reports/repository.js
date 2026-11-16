import { READING_SLOTS } from '../domain/reading-slots.js';

export function createReportRepository(pool) {
  return {
    async summarize(userId, { startDate, endDate }) {
      // One statement provides consistent statistics/details, even during concurrent CRUD.
      const { rows } = await pool.query(`
        SELECT MIN(value_mg_dl) AS min, MAX(value_mg_dl) AS max,
          ROUND(AVG(value_mg_dl), 1) AS average, COUNT(*)::integer AS count,
          COALESCE(json_agg(json_build_object(
            'id', id, 'date', to_char(reading_date, 'YYYY-MM-DD'), 'slot', slot,
            'valueMgDl', value_mg_dl, 'createdAt', created_at
          ) ORDER BY reading_date, array_position($4::text[], slot)), '[]'::json) AS readings
        FROM readings
        WHERE user_id = $1 AND reading_date >= $2::date AND reading_date <= $3::date
      `, [userId, startDate, endDate, READING_SLOTS]);
      const row = rows[0];
      return {
        summary: { min: row.min, max: row.max, average: row.average === null ? null : Number(row.average), count: row.count },
        readings: row.readings.map((reading) => ({ ...reading, createdAt: new Date(reading.createdAt).toISOString() })),
      };
    },
  };
}
