import { slotLabel } from '../reading-utils.js';
import { ErrorBox } from './Feedback.jsx';
export const REPORTS = [['daily', 'Daily'], ['month-to-date', 'Month to date'], ['previous-month', 'Previous month']];
const measurement = (value) => value === null ? '\u2014' : Number(value).toFixed(1);
export default function Reports({ states, loading }) {
  return <section id="reports-section" tabIndex={-1} aria-labelledby="reports-title"><div className="section-title"><h2 id="reports-title">Your reports</h2><span className="muted">Glucose in mg/dL</span></div>
    <div className="report-grid">{REPORTS.map(([type, title]) => {
      const state = states[type]; const report = state?.data;
      return <article className="card report" key={type} aria-labelledby={`${type}-title`}>
        <h3 id={`${type}-title`}>{title}</h3>
        {loading ? <p role="status">Loading report...</p> : state?.error ? <ErrorBox error={state.error} /> : report ? <>
          <p className="range">{report.range.startDate} &rarr; {report.range.endDate}</p>
          <dl className="stats">{[['Minimum', measurement(report.summary.min)], ['Maximum', measurement(report.summary.max)], ['Average', measurement(report.summary.average)], ['Readings', report.summary.count]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {report.summary.count === 0 && <p className="empty">No readings for this period.</p>}
          {type === 'daily' && <ul className="daily-slots">{report.slots.map(({ slot, reading }) => <li key={slot}><span>{slotLabel(slot)}</span><strong>{reading ? `${reading.valueMgDl} mg/dL` : 'Not recorded'}</strong></li>)}</ul>}
        </> : <p className="empty">Choose a date to view this report.</p>}
      </article>;
    })}</div>
  </section>;
}
