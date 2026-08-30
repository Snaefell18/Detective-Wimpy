import type { SagaVorgaben } from "./sagaTypen";
import type { Character } from "./types";

/**
 * Der versiegelte Bogen einer Saga.
 *
 * Er enthält alles, was der Spieler nicht sehen darf: den Drahtzieher, die
 * Wahrheit dahinter und was jedes Kapitel davon preisgeben soll. Er wandert
 * verschlüsselt durch den Browser, gelesen wird er nur auf dem Server.
 */
export type BogenKapitel = {
  nummer: number;
  name: string;
  teaser: string;
  erzaehlerText: string;
  auftrag: string;
  enthuellung: string;
  taeterId: string;
};

export type Bogen = {
  id: string;
  name: string;
  thema: string;
  klappentext: string;
  vorgaben: SagaVorgaben;
  /** Die Besetzung, mit der die ganze Saga gespielt wird. */
  besetzung: Character[];
  drahtzieherId: string;
  drahtzieherName: string;
  wahrheit: string;
  drahtzieherMotiv: string;
  auftaktText: string;
  kapitel: BogenKapitel[];
  finale: {
    frage: string;
    auftrag: string;
    erzaehlerText: string;
    epilogText: string;
  };
  erstelltAm: number;
};
