import type { SagaStand } from "./useSagaLauf";
import type { Kapitel3DVorgabe } from "./pursuit3d";

/** Ein Editor-Update ändert die Darstellung, niemals den laufenden Fall. */
export function aktualisiereSaga3D(stand: SagaStand, sagaId: string, kapitel3d: Kapitel3DVorgabe[]): SagaStand {
  if (!stand || stand.saga.id !== sagaId) return stand;
  if (JSON.stringify(stand.saga.vorgaben.kapitel3d ?? []) === JSON.stringify(kapitel3d)) return stand;
  return {
    ...stand,
    saga: { ...stand.saga, vorgaben: { ...stand.saga.vorgaben, kapitel3d } },
  };
}
