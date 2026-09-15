"use client";
import { useState } from 'react';
import { PursuitJumpNRun } from './PursuitJumpNRun';
import { PursuitExperiment } from './PursuitExperiment';
import { PursuitProbeWelt } from './PursuitProbeWelt';
import { AutoJagd } from './AutoJagd';
import { useStammdaten } from '@/lib/stammdaten';
export function Pursuit({ onSchliessen }: { onSchliessen: () => void }) {
  const [modus, setModus] = useState('wahl');
  const { charaktere } = useStammdaten();
  const zurueck = () => setModus('wahl');
  if (modus === 'jump') return <PursuitJumpNRun onZurueck={zurueck} onSchliessen={onSchliessen} />;
  if (modus === 'experiment') return <PursuitExperiment onZurueck={zurueck} onSchliessen={onSchliessen} />;
  if (modus === 'probe') return <PursuitProbeWelt onZurueck={zurueck} onSchliessen={onSchliessen} />;
  if (modus === 'verfolgung') return <><AutoJagd vorschau vorgabe={{ id: 'probe', nachKapitel: 1, name: 'Wimpys Verfolgungsjagd', fliehenderId: charaktere.find(c => !c.istDetektiv)?.id ?? 'Flüchtiger', verfolger: [{ charakterId: 'wimpy', modell: 'schaf' }, { charakterId: 'wimpy', modell: 'yeti' }], musik: '', fluchtgrund: 'ich den letzten Hotdog retten wollte', statement: '' }} onFertig={zurueck} /><button className="jagd-vorschau-schliessen" onClick={zurueck} aria-label="Zur Modusauswahl">×</button></>;
  return <div className="jagd pursuit-auswahl pursuit-spiel pursuit-modi"><button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button><section className="pursuit-panel"><span className="jagd-kicker">WÄHLE DEIN CHAOS</span><h1>PURSUIT</h1><div className="pursuit-moduswahl">
    {[
      ['verfolgung', 'WIMPY · DREI SPUREN', 'VERFOLGUNGSJAGD', 'Autos ausprobieren, Hindernissen ausweichen und den Fluchtwagen einholen.'],
      ['jump', 'MODUS II', 'JUMP ’N’ RUN', 'Springe über Hindernisse und sammle Hotdogs und Hennessy.'],
      ['experiment', 'MODUS III', 'WIMPY 3D', 'Bewege Wimpy frei durch Tokyo und sprich mit den Tieren.'],
      ['probe', 'MODUS IV', '3D-PROBEWELT', 'Teste Straßen, Tageszeiten, Wetter und Figuren.'],
    ].map(([id, kicker, name, text]) => <button className="pursuit-moduskarte" key={id} onClick={() => setModus(id)}><small>{kicker}</small><strong>{name}</strong><span>{text}</span><b>STARTEN ›</b></button>)}
  </div></section></div>;
}
