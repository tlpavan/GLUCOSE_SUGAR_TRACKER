import { useCallback, useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  // The bearer token stays in memory only; refreshing intentionally requires login.
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState('');
  const logout = useCallback((message = 'You have been logged out.') => { setSession(null); setNotice(message); }, []);
  const expired = useCallback(() => logout('Your session has expired. Please log in again.'), [logout]);
  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(expired, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session, expired]);
  if (!session) return <AuthScreen notice={notice} onAuthenticated={result => { setNotice(''); setSession({ user: result.user, token: result.token, expiresAt: Date.now() + result.expiresIn * 1000 }); }} />;
  return <Dashboard session={session} onLogout={logout} onExpired={expired} />;
}
