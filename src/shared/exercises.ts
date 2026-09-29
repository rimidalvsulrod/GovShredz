// The exercise library and its strength standards.
//
// `std` is what a male lifter's estimated one-rep max is, as a multiple of bodyweight, at the
// beginner / novice / intermediate / advanced / elite level (roughly the published
// strengthlevel.com standards). Dumbbell moves are per dumbbell. Bodyweight moves use reps.
// `f` scales the standards for female lifters.

export type Group = "chest" | "back" | "shoulders" | "arms" | "legs" | "core";
export type Kind = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight";
export type Std = [number, number, number, number, number];

export type Exercise = {
  id: string;
  name: string;
  group: Group;
  kind: Kind;
  std: Std;
  f: number;
  perHand?: boolean;
};

export const GROUPS: { id: Group; name: string }[] = [
  { id: "chest", name: "Chest" },
  { id: "back", name: "Back" },
  { id: "shoulders", name: "Shoulders" },
  { id: "arms", name: "Arms" },
  { id: "legs", name: "Legs" },
  { id: "core", name: "Core" },
];

/** Muscle groups that make up the overall rank (core is ranked but not counted). */
export const OVERALL_GROUPS: Group[] = ["chest", "back", "shoulders", "arms", "legs"];

const X = (id: string, name: string, group: Group, kind: Kind, std: Std, f: number, perHand = false): Exercise => ({
  id,
  name,
  group,
  kind,
  std,
  f,
  ...(perHand ? { perHand } : {}),
});

export const EXERCISES: Exercise[] = [
  // Chest
  X("bench", "Bench Press", "chest", "barbell", [0.5, 0.75, 1.25, 1.75, 2.0], 0.55),
  X("incline_bench", "Incline Bench Press", "chest", "barbell", [0.45, 0.7, 1.0, 1.4, 1.75], 0.55),
  X("db_bench", "Dumbbell Bench Press", "chest", "dumbbell", [0.2, 0.35, 0.5, 0.75, 1.0], 0.55, true),
  X("incline_db", "Incline Dumbbell Press", "chest", "dumbbell", [0.17, 0.3, 0.45, 0.65, 0.85], 0.55, true),
  X("chest_press", "Machine Chest Press", "chest", "machine", [0.4, 0.7, 1.05, 1.45, 1.9], 0.55),
  X("pec_deck", "Pec Deck / Chest Fly", "chest", "machine", [0.3, 0.55, 0.85, 1.2, 1.6], 0.55),
  X("dips", "Dips", "chest", "bodyweight", [2, 8, 18, 28, 38], 0.4),
  X("pushups", "Push-ups", "chest", "bodyweight", [5, 18, 33, 50, 70], 0.5),
  // Back
  X("deadlift", "Deadlift", "back", "barbell", [1.0, 1.5, 2.0, 2.5, 3.0], 0.72),
  X("row", "Barbell Row", "back", "barbell", [0.5, 0.75, 1.0, 1.5, 1.75], 0.6),
  X("db_row", "Dumbbell Row", "back", "dumbbell", [0.2, 0.35, 0.55, 0.8, 1.05], 0.6, true),
  X("pullups", "Pull-ups", "back", "bodyweight", [1, 5, 12, 20, 28], 0.35),
  X("chinups", "Chin-ups", "back", "bodyweight", [1, 6, 13, 21, 29], 0.35),
  X("lat_pulldown", "Lat Pulldown", "back", "cable", [0.5, 0.75, 1.0, 1.25, 1.5], 0.6),
  X("cable_row", "Seated Cable Row", "back", "cable", [0.5, 0.75, 1.0, 1.5, 1.75], 0.6),
  X("tbar_row", "T-Bar Row", "back", "machine", [0.4, 0.7, 1.0, 1.4, 1.8], 0.6),
  X("shrug", "Shrugs", "back", "barbell", [0.6, 1.0, 1.5, 2.0, 2.75], 0.65),
  // Shoulders
  X("ohp", "Overhead Press", "shoulders", "barbell", [0.35, 0.55, 0.8, 1.05, 1.35], 0.6),
  X("db_ohp", "Dumbbell Shoulder Press", "shoulders", "dumbbell", [0.15, 0.25, 0.4, 0.55, 0.75], 0.6, true),
  X("machine_ohp", "Machine Shoulder Press", "shoulders", "machine", [0.3, 0.5, 0.75, 1.05, 1.35], 0.6),
  X("lateral_raise", "Lateral Raise", "shoulders", "dumbbell", [0.05, 0.1, 0.2, 0.3, 0.4], 0.6, true),
  X("rear_delt", "Rear Delt Fly", "shoulders", "machine", [0.2, 0.35, 0.55, 0.8, 1.05], 0.6),
  X("face_pull", "Face Pull", "shoulders", "cable", [0.2, 0.35, 0.55, 0.75, 1.0], 0.6),
  // Arms
  X("curl", "Barbell Curl", "arms", "barbell", [0.2, 0.4, 0.6, 0.85, 1.15], 0.6),
  X("db_curl", "Dumbbell Curl", "arms", "dumbbell", [0.1, 0.2, 0.3, 0.45, 0.6], 0.6, true),
  X("hammer_curl", "Hammer Curl", "arms", "dumbbell", [0.1, 0.2, 0.35, 0.5, 0.65], 0.6, true),
  X("preacher_curl", "Preacher Curl", "arms", "barbell", [0.15, 0.3, 0.5, 0.7, 0.95], 0.6),
  X("pushdown", "Tricep Pushdown", "arms", "cable", [0.25, 0.5, 0.75, 1.0, 1.5], 0.6),
  X("skullcrusher", "Skull Crusher", "arms", "barbell", [0.15, 0.3, 0.5, 0.75, 1.0], 0.6),
  X("cg_bench", "Close-Grip Bench", "arms", "barbell", [0.45, 0.7, 1.0, 1.4, 1.75], 0.55),
  X("oh_extension", "Overhead Tricep Extension", "arms", "dumbbell", [0.1, 0.2, 0.35, 0.5, 0.7], 0.6),
  // Legs
  X("squat", "Squat", "legs", "barbell", [0.75, 1.25, 1.5, 2.25, 2.75], 0.72),
  X("front_squat", "Front Squat", "legs", "barbell", [0.6, 1.0, 1.25, 1.75, 2.25], 0.72),
  X("leg_press", "Leg Press", "legs", "machine", [1.0, 2.0, 3.0, 4.25, 5.5], 0.75),
  X("hack_squat", "Hack Squat", "legs", "machine", [0.75, 1.25, 1.75, 2.5, 3.25], 0.72),
  X("rdl", "Romanian Deadlift", "legs", "barbell", [0.75, 1.25, 1.5, 2.0, 2.5], 0.72),
  X("hip_thrust", "Hip Thrust", "legs", "barbell", [0.75, 1.25, 1.75, 2.5, 3.25], 0.8),
  X("bulgarian", "Bulgarian Split Squat", "legs", "dumbbell", [0.1, 0.25, 0.45, 0.65, 0.9], 0.72, true),
  X("lunge", "Dumbbell Lunge", "legs", "dumbbell", [0.1, 0.25, 0.4, 0.6, 0.8], 0.72, true),
  X("leg_extension", "Leg Extension", "legs", "machine", [0.5, 0.75, 1.25, 1.75, 2.25], 0.72),
  X("leg_curl", "Leg Curl", "legs", "machine", [0.4, 0.6, 0.9, 1.25, 1.6], 0.72),
  X("calf_raise", "Calf Raise", "legs", "machine", [0.5, 1.0, 1.75, 2.5, 3.5], 0.75),
  // Core
  X("hanging_leg_raise", "Hanging Leg Raise", "core", "bodyweight", [2, 8, 15, 22, 30], 0.6),
  X("cable_crunch", "Cable Crunch", "core", "cable", [0.3, 0.55, 0.85, 1.2, 1.6], 0.6),
  X("ab_wheel", "Ab Wheel Rollout", "core", "bodyweight", [1, 6, 14, 24, 35], 0.5),
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** Custom (unranked) exercises are stored as "c:<name>". */
export const CUSTOM_PREFIX = "c:";

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export function exerciseName(id: string) {
  return BY_ID.get(id)?.name ?? (id.startsWith(CUSTOM_PREFIX) ? id.slice(CUSTOM_PREFIX.length) : id);
}

export const isBodyweight = (id: string) => BY_ID.get(id)?.kind === "bodyweight";

/** The big lifts shown first in pickers and leaderboards. */
export const FEATURED = ["bench", "squat", "deadlift", "ohp", "pullups", "row", "curl", "leg_press"];

export function searchExercises(q: string, group?: Group | "all") {
  const t = q.trim().toLowerCase();
  return EXERCISES.filter((e) => (!group || group === "all" || e.group === group) && (!t || e.name.toLowerCase().includes(t)));
}
