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
    "id": "affin",
    "name": "Affin",
    "datei": "/animations/affin.glb",
    "animationen": [
      "Running",
      "Walking",
      "restpose"
    ]
  },
  {
    "id": "bock",
    "name": "Bock",
    "datei": "/animations/bock.glb",
    "animationen": []
  },
  {
    "id": "evilquana",
    "name": "Evilquana",
    "datei": "/animations/evilquana.glb",
    "animationen": [
      "Armature|Unreal Take|baselayer"
    ]
  },
  {
    "id": "fauli",
    "name": "Fauli",
    "datei": "/animations/fauli.glb",
    "animationen": [
      "Running",
      "Walking",
      "restpose"
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
    "id": "jumpy",
    "name": "Jumpy",
    "datei": "/animations/jumpy.glb",
    "animationen": [
      "Running",
      "Walking",
      "Backflip_and_Rise",
      "Big_Heart_Gesture",
      "Breakdance_1990",
      "Idle_4",
      "Male_Head_Down_Charge",
      "Mirror_Viewing",
      "Wake_Up_and_Look_Up",
      "golf_drive",
      "push_up",
      "sliding_rool",
      "restpose"
    ]
  },
  {
    "id": "mikkeli",
    "name": "Mikkeli",
    "datei": "/animations/mikkeli.glb",
    "animationen": [
      "Armature|Unreal Take|baselayer"
    ]
  },
  {
    "id": "wimpy",
    "name": "Wimpy",
    "datei": "/animations/wimpy.glb",
    "animationen": [
      "Running",
      "Walking",
      "Arm_Circle_Shuffle",
      "Casual_Walk",
      "FunnyDancing_01",
      "Hello_Run",
      "Idle_11",
      "Idle_15",
      "Idle_3",
      "Idle_6",
      "Male_Head_Down_Charge",
      "RunFast",
      "Shake_It_Off_Dance",
      "baseball_pitching",
      "run_fast_3",
      "restpose"
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
