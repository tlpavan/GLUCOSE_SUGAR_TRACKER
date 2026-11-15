import { useEffect, useState } from 'react';

const API_STATE = {
  checking: 'Checking API connection…',
  connected: 'API connected',
  unavailable: 'API unavailable',
};

export default function App() {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi() {
      try {
        const response = await fetch('/api/health', {
          credentials: 'include',
          signal: controller.signal,
        });
        const body = await response.json();

        if (!response.ok || body.status !== 'ok') {
          throw new Error('Unexpected health response');
        }

        setApiStatus('connected');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setApiStatus('unavailable');
        }
      }
    }

    checkApi();
    return () => controller.abort();
  }, []);

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Personal glucose journal</p>
        <h1 id="page-title">Blood Sugar Tracker</h1>
        <p className="intro">
          Record daily readings and understand your glucose history in one
          private place.
        </p>
        <p className={`status status--${apiStatus}`} role="status">
          <span aria-hidden="true" className="status__dot" />
          {API_STATE[apiStatus]}
        </p>
      </section>
    </main>
  );
}

