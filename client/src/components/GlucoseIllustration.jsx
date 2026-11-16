import { SLOTS } from '../reading-utils.js';
import Icon from './Icon.jsx';

export default function GlucoseIllustration() {
  return <div className="meter-scene" aria-label="Illustrative glucose meter showing 105 mg/dL, with the four daily reading slots">
    <div className="meter-halo" aria-hidden="true" />
    <svg className="glucose-meter" viewBox="0 0 260 340" role="img" aria-label="Example reading: 105 mg/dL. Illustration only.">
      <defs>
        <linearGradient id="meter-body" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffaf3" /><stop offset="1" stopColor="#e9cbd4" /></linearGradient>
        <linearGradient id="meter-screen" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#faf4eb" /><stop offset="1" stopColor="#e7dfce" /></linearGradient>
      </defs>
      <rect x="107" y="280" width="46" height="55" rx="7" fill="#fff9ee" /><rect x="117" y="308" width="26" height="23" rx="3" fill="#9b4860" />
      <rect x="32" y="12" width="196" height="286" rx="48" fill="#58203c" opacity=".16" transform="translate(3 8)" />
      <rect x="28" y="8" width="204" height="286" rx="48" fill="url(#meter-body)" stroke="#fff7ee" strokeWidth="3" />
      <text x="130" y="48" textAnchor="middle" fill="#762441" fontSize="19" fontFamily="sans-serif" fontWeight="700">sweety</text>
      <rect x="48" y="65" width="164" height="139" rx="18" fill="#a97386" />
      <rect x="54" y="71" width="152" height="127" rx="13" fill="url(#meter-screen)" />
      <text x="130" y="96" textAnchor="middle" fill="#6a5a58" fontSize="10" fontFamily="sans-serif" letterSpacing="2">GLUCOSE</text>
      <text x="130" y="153" textAnchor="middle" fill="#4e3038" fontSize="57" fontFamily="monospace" fontWeight="700">105</text>
      <text x="130" y="180" textAnchor="middle" fill="#6a5a58" fontSize="13" fontFamily="sans-serif">mg/dL</text>
      <circle cx="130" cy="246" r="22" fill="#a94766" /><path d="M130 234v12m-7-9a12 12 0 1 0 14 0" fill="none" stroke="#fff0e7" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="76" cy="244" r="5" fill="#d5afbb" /><circle cx="184" cy="244" r="5" fill="#d5afbb" />
    </svg>
    {SLOTS.map(([id, label], index) => <div className="orbit-tile" key={id} style={{ '--angle': `${[-145, -35, 35, 145][index]}deg`, '--delay': `${180 + index * 110}ms` }}><span className="tile-check"><Icon name="check" /></span><span>{label}</span></div>)}
    <span className="illustration-caption">Illustration only &middot; Not your reading</span>
  </div>;
}
