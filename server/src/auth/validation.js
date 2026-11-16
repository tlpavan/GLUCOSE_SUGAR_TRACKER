import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(254).email();
// bcrypt truncates after 72 UTF-8 bytes; validate bytes, not JavaScript characters.
const password = z.string().refine((value) => {
  const bytes = Buffer.byteLength(value, 'utf8');
  return bytes >= 8 && bytes <= 72;
}, 'Password must contain 8 to 72 UTF-8 bytes.');

export const registrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password,
}).strict();

export const loginSchema = z.object({ email, password }).strict();

export function parseCredentials(schema, body) {
  const result = schema.safeParse(body);
  if (result.success) return { data: result.data };
  const fields = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (['name', 'email', 'password'].includes(field)) fields[field] = issue.message;
  }
  return { error: {
    code: 'VALIDATION_ERROR',
    message: 'Please provide valid credentials. Passwords must contain 8 to 72 UTF-8 bytes.',
    fields,
  } };
}
