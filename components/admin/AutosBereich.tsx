"use client";
import { useState } from 'react';
import { useAutos } from '@/lib/useAutos';
import { AUTO_MODELLE, autoGueltig, START_AUTO_ID, type Auto } from '@/lib/autos';
import { speichereZubehoer } from '@/lib/db';
import type { BereichProps } from './typen';
export function AutosBereich({ onMeldung, onFehler }: BereichProps) {
  const { autos, laden, fehler } = useAutos();
  const [entwurf, setEntwurf] = useState<Auto | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const neu = () => setEntwurf({ id: `auto-${crypto.randomUUID()}`, name: 'Neues Auto', modell: AUTO_MODELLE[0]?.id ?? '', speed: 160, beschleunigung: 30, drehung: 0, preis: 800, bild: '', beschreibung: '', wirkung: 'auto', erstelltAm: Date.now() });
  const speichern = async () => {
    if (!entwurf || !autoGueltig(entwurf)) { onFehler('Bitte Modell, Namen und gültige Fahrwerte eingeben.'); return; }
    setSpeichert(true);
    try {
      await speichereZubehoer({ ...entwurf, preis: entwurf.id === START_AUTO_ID ? 0 : Math.round(entwurf.preis), versteckt: entwurf.id === START_AUTO_ID ? false : entwurf.versteckt ?? false });
      await laden(); setEntwurf(null); onMeldung('Auto gespeichert – im Shop und in der Jagd verfügbar.');
    } catch { onFehler('Auto konnte nicht gespeichert werden.'); }
    finally { setSpeichert(false); }
  };
  return <><h2>Autos</h2><p className="leise">Wimpys Garage · Speed in km/h, Beschleunigung in km/h pro Sekunde. Der kostenlose Startwagen hält bestehende Sagas spielbar.</p>
    {fehler && <p className="fehler">{fehler}</p>}
    <button className="knopf" onClick={neu}>Auto hinzufügen</button>
    {autos.map(auto => <div className="kapitel-block" key={auto.id}><strong>{auto.name}</strong><p>{auto.speed} km/h · Beschleunigung {auto.beschleunigung} · ¥{auto.preis}</p><button className="knopf" onClick={() => setEntwurf(auto)}>Bearbeiten</button></div>)}
    {entwurf && <div className="kapitel-block">
      <label className="feld">Name<input maxLength={80} value={entwurf.name} onChange={e => setEntwurf({ ...entwurf, name: e.target.value })} /></label>
      <label className="feld">3D-Modell<select value={entwurf.modell} onChange={e => setEntwurf({ ...entwurf, modell: e.target.value })}>{AUTO_MODELLE.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {(['speed', 'beschleunigung', 'preis', 'drehung'] as const).map(feld => <label className="feld" key={feld}>{({ speed: 'Speed (60–320 km/h)', beschleunigung: 'Beschleunigung (5–100 km/h pro Sekunde)', preis: 'Preis in Yen', drehung: 'Modelldrehung in Grad' })[feld]}<input type="number" disabled={feld === 'preis' && entwurf.id === START_AUTO_ID} value={entwurf[feld]} onChange={e => setEntwurf({ ...entwurf, [feld]: Number(e.target.value) })} /></label>)}
      <label className="feld">Beschreibung<textarea maxLength={600} value={entwurf.beschreibung} onChange={e => setEntwurf({ ...entwurf, beschreibung: e.target.value })} /></label>
      {entwurf.id !== START_AUTO_ID && <label><input type="checkbox" checked={entwurf.versteckt ?? false} onChange={e => setEntwurf({ ...entwurf, versteckt: e.target.checked })} /> Aus dem Verkauf nehmen (Besitz bleibt erhalten)</label>}
      <button className="knopf aktion" disabled={speichert} onClick={() => void speichern()}>Speichern</button><button className="knopf" onClick={() => setEntwurf(null)}>Abbrechen</button>
    </div>}</>;
}
