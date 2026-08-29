/** Alle Admin-Bereiche melden Erfolg und Fehler an die Seite zurück. */
export type BereichProps = {
  onMeldung: (text: string) => void;
  onFehler: (text: string | null) => void;
};
