export function createUserRepository(pool) {
  return {
    async create({ name, email, passwordHash }) {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
         RETURNING id, name, email`,
        [name, email, passwordHash],
      );
      return rows[0];
    },
    async findByEmail(email) {
      const { rows } = await pool.query(
        'SELECT id, name, email, password_hash FROM users WHERE lower(email) = $1', [email],
      );
      return rows[0];
    },
    async findPublicById(id) {
      const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [id]);
      return rows[0];
    },
  };
}
