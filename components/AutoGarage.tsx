"use client";
import { useState } from 'react';
import { useAutos } from '@/lib/useAutos';
import { START_AUTO_ID, type Auto } from '@/lib/autos';
export function AutoGarage({ yen, vorrat, autoId, kaufen, waehlen }: { yen: number; vorrat: Record<string, number>; autoId?: string; kaufen: (auto: Auto) => boolean; waehlen: (id: string) => void }) {
  const { autos, fehler } = useAutos();
  const [meldung, setMeldung] = useState('');
  return <section><h2>Wimpys Garage</h2><p className="leise">Dein aktives Auto fährt in jeder Verfolgungsjagd. Einmal gekauft, bleibt es in deiner Garage.</p>{fehler && <p>{fehler}</p>}{meldung && <p role="status">{meldung}</p>}
    {autos.filter(a => !a.versteckt || vorrat[a.id]).map(a => {
      const besitzt = a.id === START_AUTO_ID || Boolean(vorrat[a.id]);
      const aktiv = (autoId ?? START_AUTO_ID) === a.id;
      return <article key={a.id} className="kapitel-block"><h3>{a.name}</h3><p>{a.beschreibung}</p><p>{a.speed} km/h · Beschleunigung {a.beschleunigung} km/h/s · ¥{a.preis}</p>
        <button className="knopf" disabled={aktiv || (!besitzt && yen < a.preis)} onClick={() => { if (besitzt) waehlen(a.id); else setMeldung(kaufen(a) ? `${a.name} gekauft und ausgewählt.` : 'Kauf nicht möglich.'); }}>{aktiv ? 'Aktiver Wagen' : besitzt ? 'Fahren' : 'Kaufen und fahren'}</button>
      </article>;
    })}</section>;
}
