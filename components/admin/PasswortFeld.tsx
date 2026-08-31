"use client";

import { useState } from "react";
import { adminToken, setzeAdminToken } from "@/lib/akte";

/**
 * Das Passwort für die Akten (ADMIN_TOKEN auf dem Server).
 *
 * Es bleibt auf dem Gerät und wird nur mitgeschickt, wenn eine Akte geöffnet
 * oder gespeichert wird. Beim Entwickeln auf dem eigenen Rechner ist es nicht
 * nötig - dort sind die Akten ohnehin offen.
 */
export function PasswortFeld() {
  const [offen, setOffen] = useState(false);
  const [wert, setWert] = useState("");

  if (!offen) {
    return (
      <button className="knopf klein" onClick={() => { setWert(adminToken()); setOffen(true); }}>
        🔑 Akten-Passwort
      </button>
    );
  }

  return (
    <div className="kapitel-block">
      <label className="feld">
        <span className="leise">
          Akten-Passwort · muss dem ADMIN_TOKEN auf dem Server entsprechen
        </span>
        <input
          type="password"
          value={wert}
          onChange={(e) => setWert(e.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="knopf-reihe">
        <button
          className="knopf klein aktion"
          onClick={() => {
            setzeAdminToken(wert.trim());
            setOffen(false);
          }}
        >
          Merken
        </button>
        <button className="knopf klein" onClick={() => setOffen(false)}>
          Schließen
        </button>
      </div>
    </div>
  );
}
