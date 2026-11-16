import GlucoseIllustration from './GlucoseIllustration.jsx';
import Icon from './Icon.jsx';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorBox, FieldError } from './Feedback.jsx';

export default function AuthScreen({ onAuthenticated, notice }) {
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [success, setSuccess] = useState(null);
  useEffect(() => {
    if (!success) return undefined;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    const timer = setTimeout(() => onAuthenticated(success), delay);
    return () => clearTimeout(timer);
  }, [success, onAuthenticated]);
  const [register, setRegister] = useState(false);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const change = (event) => setValues({ ...values, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    const fields = {};
    if (register && !values.name.trim()) fields.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) fields.email = 'Enter a valid email address.';
    const bytes = new TextEncoder().encode(values.password).length;
    if (bytes < 8 || bytes > 72) fields.password = 'Use a password between 8 and 72 UTF-8 bytes.';
    setErrors(fields); setError(null);
    if (Object.keys(fields).length) return;
    setBusy(true);
    try {
      const body = { email: values.email.trim(), password: values.password, ...(register ? { name: values.name.trim() } : {}) };
      const result = await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body });
      setSuccess(result);
    } catch (failure) { setError(failure); setErrors(failure.fields || {}); setBusy(false); }
  }
  return <main className={`auth-shell${success ? ' is-leaving' : ''}`}>
    <section className="auth-intro">
      <a className="brand auth-brand" href="#auth-title"><span className="brand-symbol"><Icon name="drop" /></span>Sweety<span className="brand-dot">.</span></a>
      <p className="eyebrow">YOUR EVERYDAY GLUCOSE COMPANION</p>
      <h1>Small moments.<br /><em>A clearer picture.</em></h1>
      <p className="auth-description">A little more clarity, every day. Keep your readings and your history beautifully together.</p>
      <GlucoseIllustration />
      <div className="auth-features"><div><Icon name="readings" /><span><strong>Simple daily tracking</strong><small>Four familiar moments in your day.</small></span></div><div><Icon name="reports" /><span><strong>Your history, at a glance</strong><small>Daily and monthly summaries.</small></span></div></div>
    </section>
    <section className="card auth-card" aria-labelledby="auth-title">
      <div className="auth-card-top"><span className="mini-mark"><Icon name="drop" /></span><span className="eyebrow">A LITTLE MOMENT FOR YOU</span></div>
      <h2 id="auth-title">{register ? 'Hello, new beginnings.' : 'Welcome Back'} {!register && <span className="welcome-hand" aria-hidden="true">&#128075;</span>}</h2>
      <p className="muted">{register ? 'Create your account and start your personal journal.' : 'Your journal is right where you left it. Sign in to continue.'}</p>
      {notice && <p className="notice" role="status">{notice}</p>}<ErrorBox error={error} />
      {success && <p className="notice success" role="status">Signed in. Opening your journal...</p>}
      <form onSubmit={submit} noValidate><fieldset disabled={busy}>
        {register && <label>Name<input name="name" autoComplete="name" placeholder="Your name" maxLength={100} value={values.name} onChange={change} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} /><FieldError name="name" errors={errors} /></label>}
        <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" maxLength={254} value={values.email} onChange={change} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} /><FieldError name="email" errors={errors} /></label>
        <div className="password-field"><label htmlFor="auth-password">Password</label><div className="password-control"><input id="auth-password" name="password" type={visiblePassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete={register ? 'new-password' : 'current-password'} value={values.password} onChange={change} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} /><button className="password-toggle" type="button" aria-label={visiblePassword ? 'Hide password' : 'Show password'} aria-pressed={visiblePassword} onClick={() => setVisiblePassword(!visiblePassword)}><Icon name="eye" /></button></div><FieldError name="password" errors={errors} /></div>
        {register && <p className="hint">Use 8-72 UTF-8 bytes. Ordinary letters and numbers use one byte each.</p>}
        <button className="primary full auth-submit" type="submit">{busy ? 'Please wait...' : register ? 'Create Account' : 'Sign In'}<Icon name="arrow" /></button>
      </fieldset></form>
      <div className="auth-divider"><span>{register ? 'Already part of Sweety?' : 'New here? Make yourself at home.'}</span></div>
      <button className="secondary full" disabled={busy} onClick={() => { setRegister(!register); setVisiblePassword(false); setError(null); setErrors({}); setValues({ name: '', email: '', password: '' }); }}>{register ? 'Sign In' : 'Create Account'}</button>
      <p className="hint session-note">Your session stays private to this tab.<br />Refreshing or session expiry requires a new sign-in.</p>
    </section>
    <span className="auth-footer">KENPATH &middot; SWEETY BLOOD GLUCOSE TRACKER</span>
  </main>;
}
