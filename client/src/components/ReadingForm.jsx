import { useState } from 'react';
import { SLOTS, readingErrors, localToday } from '../reading-utils.js';
import { ErrorBox, FieldError } from './Feedback.jsx';

export default function ReadingForm({ selectedDate, editing, onSave, onCancel }) {
  const [values, setValues] = useState(editing ? { date: editing.date, slot: editing.slot, valueMgDl: String(editing.valueMgDl) } : { date: selectedDate, slot: SLOTS[0][0], valueMgDl: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const change = (event) => setValues({ ...values, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    const fields = readingErrors(values);
    setErrors(fields); setError(null);
    if (Object.keys(fields).length) return;
    setBusy(true);
    try {
      await onSave({ date: values.date, slot: values.slot, valueMgDl: Number(values.valueMgDl) }, editing?.id);
      if (!editing) setValues({ ...values, valueMgDl: '' });
    } catch (failure) { setError(failure); setErrors(failure.fields || {}); }
    finally { setBusy(false); }
  }
  return <section className="card" aria-labelledby="reading-form-title">
    <p className="eyebrow">YOUR JOURNAL</p><h2 id="reading-form-title">{editing ? 'Edit reading' : 'Add a reading'}</h2>
    <p className="muted">One reading per slot, up to four per day.</p><ErrorBox error={error} />
    <form onSubmit={submit} noValidate><fieldset disabled={busy}>
      <label>Reading date<input name="date" type="date" min="0001-01-01" max={localToday()} value={values.date} onChange={change} aria-invalid={!!errors.date} aria-describedby={errors.date ? 'date-error' : undefined} /><FieldError name="date" errors={errors} /></label>
      <label>Reading slot<select name="slot" value={values.slot} onChange={change} aria-invalid={!!errors.slot} aria-describedby={errors.slot ? 'slot-error' : undefined}>{SLOTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><FieldError name="slot" errors={errors} /></label>
      <label>Glucose (mg/dL)<input name="valueMgDl" inputMode="numeric" type="number" min="40" max="600" step="1" placeholder="e.g. 105" value={values.valueMgDl} onChange={change} aria-invalid={!!errors.valueMgDl} aria-describedby={errors.valueMgDl ? 'valueMgDl-error' : 'glucose-hint'} /><FieldError name="valueMgDl" errors={errors} /></label>
      <p id="glucose-hint" className="hint">Whole numbers from 40 to 600 mg/dL.</p>
      <div className="actions"><button type="submit" className="primary">{busy ? 'Saving...' : editing ? 'Save changes' : 'Save reading'}</button>{editing && <button type="button" onClick={onCancel}>Cancel edit</button>}</div>
    </fieldset></form>
  </section>;
}
