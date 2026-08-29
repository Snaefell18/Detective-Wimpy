"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase-Anbindung.
 *
 * Die Web-Konfiguration ist öffentlich (sie steckt in jeder Firebase-App im
 * Browser) - der Schutz kommt aus den Sicherheitsregeln in firestore.rules.
 * Über NEXT_PUBLIC_FIREBASE_* lässt sich ein anderes Projekt einhängen.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBesXrfVPJWgTZZL-3QMSN275khulpHAlk",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "detective-wimpy.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "detective-wimpy",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "detective-wimpy.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "528521383821",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:528521383821:web:f7df47e0c5ec118218b7c4",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let anmeldung: Promise<void> | null = null;

function getApp(): FirebaseApp {
  app ??= getApps()[0] ?? initializeApp(config);
  return app;
}

export function getDb(): Firestore {
  db ??= getFirestore(getApp());
  return db;
}

/**
 * Schreiben ist laut Regeln nur angemeldeten Geräten erlaubt. Die anonyme
 * Anmeldung passiert einmal im Hintergrund und braucht keine Eingabe.
 *
 * Voraussetzung: In der Firebase-Konsole unter Authentication die Anmeldeart
 * "Anonym" aktivieren. Ohne sie funktioniert Lesen weiterhin, Schreiben nicht.
 */
export function anmelden(): Promise<void> {
  anmeldung ??= (async () => {
    auth ??= getAuth(getApp());
    if (auth.currentUser) return;
    await signInAnonymously(auth);
  })().catch((fehler) => {
    // Nicht aktivierte anonyme Anmeldung darf das Spiel nicht blockieren -
    // Lesen geht weiter, nur Schreiben nicht.
    console.warn("[firebase] Anonyme Anmeldung nicht möglich:", fehler);
    anmeldung = null;
    throw new Error(
      "Schreiben in die Datenbank ist nicht erlaubt. In der Firebase-Konsole unter " +
        "Authentication die Anmeldeart „Anonym“ aktivieren und die Regeln aus " +
        "firestore.rules veröffentlichen.",
    );
  });
  return anmeldung;
}

export const FIREBASE_PROJEKT = config.projectId;
