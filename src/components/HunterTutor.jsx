import { useState } from 'react';
import { HUNTER_SCENES, TUTORS } from '../data/hunterTutors.js';
import '../styles/hunter-tutor.css';

function Portrait({ tutor }) {
  const [failed, setFailed] = useState(false);
  return <span className="ht-portrait" data-art={tutor.portrait.endsWith('.gif') ? 'sheet' : 'banner'} aria-hidden="true">
    {failed ? <span>{tutor.name}</span> : <img key={tutor.id} src={tutor.portrait} alt="" loading="lazy" onError={() => setFailed(true)} />}
  </span>;
}

/* A presentation-only teacher. No timers, speech, network calls or progress writes.
   Children are the existing lesson/explanation, so facts and grading stay intact. */
export default function HunterTutor({ guide = 'wing', scene = 'arena', mood = 'explain', title, line, peer, children, compact = false }) {
  const tutor = TUTORS[guide] || TUTORS.wing;
  const place = HUNTER_SCENES[scene] || HUNTER_SCENES.arena;
  const partner = peer && TUTORS[peer.guide];
  return <aside className={`hunter-tutor${compact ? ' ht-compact' : ''}`} data-guide={tutor.id} data-scene={scene} data-mood={mood} aria-label={`${tutor.name} · ${title || tutor.role}`}>
    <div className="ht-speaker">
      <Portrait key={tutor.id} tutor={tutor} />
      <div className="ht-bubble">
        <small className="ht-place">{place.name} <span>· {place.label}</span></small>
        <div className="ht-name"><b>{tutor.name}</b><span>{title || tutor.role}</span><i aria-hidden="true">{mood === 'celebrate' ? '✦' : mood === 'encourage' ? '↗' : '◇'}</i></div>
        {line && <p>{line}</p>}
      </div>
    </div>
    {partner && <div className="ht-peer"><Portrait key={partner.id} tutor={partner} /><p><b>{partner.name}</b>{peer.line}</p></div>}
    {children && <div className="ht-lesson">{children}</div>}
  </aside>;
}
