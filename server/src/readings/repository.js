import { READING_SLOTS } from '../domain/reading-slots.js';

// Format DATE in SQL so pg never converts it into a timezone-sensitive JS Date.
const columns = `id, to_char(reading_date, 'YYYY-MM-DD') AS date, slot,
  value_mg_dl AS "valueMgDl", created_at AS "createdAt"`;

export function createReadingRepository(pool) {
  return {
    async create(userId, { date, slot, valueMgDl }) {
      const { rows } = await pool.query(`INSERT INTO readings (user_id, reading_date, slot, value_mg_dl)
        VALUES ($1, $2, $3, $4) RETURNING ${columns}`, [userId, date, slot, valueMgDl]);
      return rows[0];
    },
    async list(userId, date) {
      const { rows } = await pool.query(`SELECT ${columns} FROM readings
        WHERE user_id = $1 AND reading_date = $2
        ORDER BY array_position($3::text[], slot)`, [userId, date, READING_SLOTS]);
      return rows;
    },
    async update(userId, id, { date, slot, valueMgDl }) {
      const { rows } = await pool.query(`UPDATE readings
        SET reading_date = $1, slot = $2, value_mg_dl = $3
        WHERE id = $4 AND user_id = $5 RETURNING ${columns}`, [date, slot, valueMgDl, id, userId]);
      return rows[0];
    },
    async remove(userId, id) {
      const { rowCount } = await pool.query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [id, userId]);
      return rowCount > 0;
    },
  };
}
