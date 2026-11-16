export function ErrorBox({ error }) {
  return error ? <div className="notice error" role="alert">{error.message || error}</div> : null;
}
export function FieldError({ name, errors }) {
  return errors?.[name] ? <span className="field-error" id={`${name}-error`}>{errors[name]}</span> : null;
}
