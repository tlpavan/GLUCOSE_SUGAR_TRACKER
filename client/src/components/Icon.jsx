const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  readings: 'M8 3H5v18h14V3h-3 M9 2h6v4H9z M8 11h8 M8 16h5',
  reports: 'M4 3h12l4 4v14H4z M8 11h8 M8 15h8 M8 18h4',
  logout: 'M9 4H4v16h5 M13 8l4 4-4 4 M8 12h13',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  drop: 'M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12z',
  down: 'M12 4v16 M6 14l6 6 6-6',
  up: 'M12 20V4 M6 10l6-6 6 6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  check: 'M5 12l4 4L19 6',
};
export default function Icon({ name, className = '' }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.drop} /></svg>;
}
