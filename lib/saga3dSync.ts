import type { SagaStand } from "./useSagaLauf";
import type { Kapitel3DVorgabe } from "./pursuit3d";
import { auftrittVon, besetzungFuerSaga, dreiDFuerKapitel, type Saga, type SagaVorgaben } from "./sagaTypen";
import type { Character } from "./types";

/** Die Fall-ID ordnet auch fortgesetzte Fälle eindeutig ihrem Kapitel zu. */
export function dreiDFuerSagaFall(saga: Saga, fallId: string) {
  const kapitel = saga.kapitel.find(k => k.fall?.id === fallId);
  if (kapitel) return dreiDFuerKapitel(saga.vorgaben, kapitel.nummer - 1);
  return saga.finale?.fall?.id === fallId ? dreiDFuerKapitel(saga.vorgaben, saga.vorgaben.kapitelAnzahl) : null;
}

/** Vor der Generierung nur fest eingeplante Tiere anbieten; tatsächliche Fälle sind später maßgeblich. */
export function sichere3DTiere(vorgaben: SagaVorgaben, tiere: Character[], index: number) {
  const nummer = index + 1;
  if (vorgaben.twist && !vorgaben.drahtzieherId && index < vorgaben.kapitelAnzahl) return [];
  return besetzungFuerSaga(tiere, vorgaben).filter(c =>
    !c.istDetektiv &&
    auftrittVon({ charakterId: c.id, vorgaben, drahtzieherId: vorgaben.drahtzieherId }) <= nummer &&
    !(vorgaben.abwesenheiten?.[c.id] ?? []).includes(nummer) &&
    !(index === vorgaben.kapitelAnzahl && vorgaben.besessenheit?.wirtId === c.id && vorgaben.besessenheit?.daemonId)
  );
}

export function kapitel3DMitBesetzung(konfiguration: Kapitel3DVorgabe, tiere: Pick<Character, "id">[]) {
  const ids = new Set(tiere.map(c => c.id));
  return {
    ...konfiguration,
    charakterModelle: Object.fromEntries(Object.entries(konfiguration.charakterModelle ?? {}).filter(([id]) => ids.has(id))),
    charakterGroessen: Object.fromEntries(Object.entries(konfiguration.charakterGroessen ?? {}).filter(([id]) => ids.has(id))),
  };
}

export function bereinigteSaga3D(saga: Saga) {
  return (saga.vorgaben.kapitel3d ?? []).map((konfiguration, index) => {
    const fall = index === saga.vorgaben.kapitelAnzahl ? saga.finale?.fall : saga.kapitel.find(k => k.nummer === index + 1)?.fall;
    return fall ? kapitel3DMitBesetzung(konfiguration, fall.besetzung) : konfiguration;
  });
}

/** Ein Editor-Update ändert die Darstellung, niemals den laufenden Fall. */
export function aktualisiereSaga3D(stand: SagaStand, sagaId: string, kapitel3d: Kapitel3DVorgabe[]): SagaStand {
  if (!stand || stand.saga.id !== sagaId) return stand;
  if (JSON.stringify(stand.saga.vorgaben.kapitel3d ?? []) === JSON.stringify(kapitel3d)) return stand;
  return {
    ...stand,
    saga: { ...stand.saga, vorgaben: { ...stand.saga.vorgaben, kapitel3d } },
  };
}
