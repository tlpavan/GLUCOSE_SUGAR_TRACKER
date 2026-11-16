import Icon from './Icon.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { dateError, localToday, slotLabel } from '../reading-utils.js';
import ReadingForm from './ReadingForm.jsx';
import Reports, { REPORTS } from './Reports.jsx';
import { ErrorBox } from './Feedback.jsx';

export default function Dashboard({ session, onLogout, onExpired }) {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [date, setDate] = useState(localToday);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState({ data: [], error: null });
  const [reports, setReports] = useState({});
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const cancelDelete = useRef(null);
  const formAnchor = useRef(null);
  const request = useCallback((path, options = {}) => api(path, { ...options, token: session.token, onExpired }), [session.token, onExpired]);
  const selectedError = dateError(date);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setList({ data: [], error: null }); setReports({});
    if (dateError(date)) { setLoading(false); return () => controller.abort(); }
    async function load() {
      const query = `?date=${encodeURIComponent(date)}`;
      const results = await Promise.allSettled([
        request(`/readings${query}`, { signal: controller.signal }),
        ...REPORTS.map(([type]) => request(`/reports/${type}${query}`, { signal: controller.signal })),
      ]);
      if (controller.signal.aborted) return;
      setList(results[0].status === 'fulfilled' ? { data: results[0].value.readings, error: null } : { data: [], error: results[0].reason });
      setReports(Object.fromEntries(REPORTS.map(([type], index) => [type, results[index + 1].status === 'fulfilled' ? { data: results[index + 1].value } : { error: results[index + 1].reason }])));
      setLoading(false);
    }
    load();
    return () => controller.abort();
  }, [date, revision, request]);
  useEffect(() => { if (deleting) cancelDelete.current?.focus(); }, [deleting]);

  function navigateTo(id) {
    setActiveNav(id === 'reading-editor' ? 'readings-section' : id);
    const target = document.getElementById(id);
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior, block: 'start' });
  }
  const summary = reports.daily?.data?.summary;
  const statValue = (key) => loading ? '...' : !summary || summary[key] === null ? '\u2014' : key === 'count' ? summary[key] : Number(summary[key]).toFixed(1);

  async function save(body, id) {
    await request(id ? `/readings/${id}` : '/readings', { method: id ? 'PUT' : 'POST', body });
    setNotice(id ? 'Reading updated.' : 'Reading saved.'); setEditing(null);
    setDate(body.date); setRevision(value => value + 1);
  }
  async function remove() {
    setDeleteBusy(true); setDeleteError(null);
    try {
      await request(`/readings/${deleting.id}`, { method: 'DELETE' });
      if (editing?.id === deleting.id) setEditing(null);
      setDeleting(null); setNotice('Reading deleted.'); setRevision(value => value + 1);
    } catch (error) { setDeleteError(error); }
    finally { setDeleteBusy(false); }
  }
  return <div className="workspace dashboard-enter">
    <a className="skip-link" href="#dashboard">Skip to dashboard</a>
    <aside className="sidebar" aria-label="Main navigation">
      <a className="brand" href="#dashboard" onClick={event => { event.preventDefault(); navigateTo('dashboard'); }}><span className="brand-symbol"><Icon name="drop" /></span>Sweety<span className="brand-dot">.</span></a>
      <p className="sidebar-caption">A little clarity, every day.</p>
      <nav>{[['dashboard', 'Dashboard', 'grid'], ['readings-section', 'Readings', 'readings'], ['reports-section', 'Reports', 'reports']].map(([id, label, icon]) => <a key={id} href={`#${id}`} className={activeNav === id ? 'active' : ''} aria-current={activeNav === id ? 'location' : undefined} onClick={event => { event.preventDefault(); navigateTo(id); }}><Icon name={icon} /><span>{label}</span></a>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-user"><span className="avatar" aria-hidden="true">{session.user.name.charAt(0).toUpperCase()}</span><div><strong>{session.user.name}</strong><small>Personal journal</small></div></div><button className="logout-button" onClick={() => onLogout()}><Icon name="logout" />Logout</button></div>
    </aside>
    <div className="workspace-frame">
    
<header className="topbar">
  <span className="topbar-title">
    Your personal glucose journal
  </span>

  <div className="identity">
    <span>
      {session.user.name}
      <small>{session.user.email}</small>
    </span>

    <span className="avatar" aria-hidden="true">
      {session.user.name.charAt(0).toUpperCase()}
    </span>
  </div>
</header>

    <main id="dashboard" tabIndex={-1} className="content"><div className="page-heading"><div><p className="eyebrow">A FRESH LOOK AT YOUR DAY</p><h1>Hello, {session.user.name}<span className="greeting-dot">.</span></h1><p className="muted">Your journal for <strong>{date || 'your selected date'}</strong>. Every reading has its place.</p></div><button className="primary add-reading" onClick={() => { setEditing(null); navigateTo('reading-editor'); }}><Icon name="plus" />Add Reading</button></div>
      <div className="date-toolbar"><label htmlFor="selected-date">Selected date<input id="selected-date" type="date" min="0001-01-01" max={localToday()} value={date} aria-invalid={!!selectedError} aria-describedby={selectedError ? 'selected-error' : undefined} onChange={event => { setDate(event.target.value); setEditing(null); setNotice(''); }} /></label><p>Readings and all reports use this date.</p><button disabled={loading || !!selectedError} onClick={() => setRevision(value => value + 1)}>Refresh</button></div>
      {selectedError && <p id="selected-error" className="notice error" role="alert">{selectedError}</p>}
      {notice && <p className="notice success" role="status">{notice}</p>}
      <section className="overview" aria-label="Daily statistics for selected date">{[['average', 'Average glucose', 'drop'], ['min', 'Minimum glucose', 'down'], ['max', 'Maximum glucose', 'up'], ['count', 'Readings recorded', 'readings']].map(([key, label, icon], index) => <article className={`overview-card overview-${key}`} key={key} style={{ '--stagger': `${index * 70}ms` }}><span className="stat-icon"><Icon name={icon} /></span><p>{label}</p><strong>{statValue(key)}<small>{key === 'count' ? 'of 4 daily slots' : 'mg/dL'}</small></strong><span className="stat-context">{loading ? 'Loading your day...' : reports.daily?.error ? 'Report unavailable - retry below' : !summary ? 'Choose a valid date' : summary.count === 0 ? 'No readings for this day' : 'For your selected date'}</span></article>)}</section>
      <div className="section-title journal-heading"><div><p className="eyebrow">LITTLE MOMENTS, ALL TOGETHER</p><h2>Your reading journal</h2></div><span className="muted">Four slots. One simple routine.</span></div>
      <div className="journal-grid" id="readings-section" tabIndex={-1}><div ref={formAnchor} id="reading-editor" tabIndex={-1}><ReadingForm key={`${editing?.id || 'new'}-${date}-${revision}`} selectedDate={date} editing={editing} onSave={save} onCancel={() => setEditing(null)} /></div>
        <section className="card" aria-labelledby="readings-title"><div className="section-title"><h2 id="readings-title">Readings</h2>{!loading && !list.error && <span className="pill">{list.data.length} / 4 recorded</span>}</div><p className="muted">{date || 'Choose a date'}</p>
          {loading ? <p role="status">Loading readings...</p> : list.error ? <><ErrorBox error={list.error} /><button onClick={() => setRevision(value => value + 1)}>Try again</button></> : list.data.length === 0 ? <div className="empty spacious"><strong>No readings yet.</strong><p>Add a reading for this date to start your journal.</p></div> : <>
            {list.data.length === 4 && <p className="notice">All four slots are recorded for this day. You can edit an existing reading.</p>}
            <div className="table-wrap"><table><thead><tr><th>Date / slot</th><th>mg/dL</th><th>Actions</th></tr></thead><tbody>{list.data.map(reading => <tr key={reading.id}><td><strong>{slotLabel(reading.slot)}</strong><small>{reading.date}</small></td><td className="reading-value">{reading.valueMgDl}</td><td><div className="actions"><button aria-label={`Edit ${slotLabel(reading.slot)}`} onClick={() => { setEditing(reading); setNotice(''); navigateTo('reading-editor'); }}>Edit</button><button className="danger-text" aria-label={`Delete ${slotLabel(reading.slot)}`} onClick={() => { setDeleting(reading); setDeleteError(null); }}>Delete</button></div></td></tr>)}</tbody></table></div>
          </>}
        </section>
      </div>
      <Reports states={reports} loading={loading} />
      <footer>Four moments each day. Your history, in one place.</footer>
    </main>
    </div>
    {deleting && <div className="modal-backdrop"><section className="card modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description" onKeyDown={event => { if (event.key === 'Escape' && !deleteBusy) setDeleting(null); if (event.key === 'Tab') { const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]; if (!buttons.length) return; if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="delete-title">Delete this reading?</h2><p id="delete-description">{slotLabel(deleting.slot)} &middot; {deleting.date} &middot; {deleting.valueMgDl} mg/dL. This cannot be undone.</p><ErrorBox error={deleteError} /><div className="actions"><button ref={cancelDelete} disabled={deleteBusy} onClick={() => setDeleting(null)}>Keep reading</button><button className="danger" disabled={deleteBusy} onClick={remove}>{deleteBusy ? 'Deleting...' : 'Delete reading'}</button></div>
    </section></div>}
  </div>;
}
