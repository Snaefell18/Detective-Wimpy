/**
 * Alle GLB-Charaktere aus /public/animations - erzeugt von
 * scripts/animations-liste.mjs. Nicht von Hand ändern.
 */
export type AnimationsModell = {
  id: string;
  name: string;
  datei: string;
  animationen: string[];
};

export const ANIMATIONS_MODELLE: AnimationsModell[] = [
  {
    "id": "evilquana",
    "name": "Evilquana",
    "datei": "/animations/evilquana.glb",
    "animationen": [
      "Armature|Unreal Take|baselayer"
    ]
  },
  {
    "id": "herr",
    "name": "Herr",
    "datei": "/animations/herr.glb",
    "animationen": [
      "Armature|Unreal Take|baselayer"
    ]
  },
  {
    "id": "yeti",
    "name": "Yeti",
    "datei": "/animations/yeti.glb",
    "animationen": [
      "Running",
      "Walking",
      "Angry_Ground_Stomp",
      "Arm_Circle_Shuffle",
      "Cardio_Dance",
      "FunnyDancing_02",
      "Idle_11",
      "Idle_5",
      "Lean_Forward_Sprint",
      "Mirror_Viewing",
      "Shake_It_Off_Dance",
      "Show_Both_Arm_Muscles",
      "Stand_and_Drink",
      "baseball_pitching",
      "ymca_dance",
      "restpose"
    ]
  }
];
