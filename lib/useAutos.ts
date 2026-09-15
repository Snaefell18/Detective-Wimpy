"use client";
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { getDb } from './firebase';
import { autoRegal, STANDARD_AUTOS, type Auto } from './autos';
export function useAutos() {
  const [autos, setAutos] = useState(STANDARD_AUTOS);
  const [fehler, setFehler] = useState('');
  const laden = async () => {
    try {
      const daten = await getDocs(collection(getDb(), 'zubehoer'));
      setAutos(autoRegal(daten.docs.map(d => ({ ...d.data(), id: d.id }) as Auto).filter(a => a.wirkung === 'auto')));
      setFehler('');
    } catch { setFehler('Autokatalog konnte nicht geladen werden. Standardwagen verfügbar.'); }
  };
  useEffect(() => { void laden(); }, []);
  return { autos, laden, fehler };
}
