// Framework-free domain code shared by apps/react and apps/svelte.
// Exported straight from source: each app's Vite and Vitest compile it, so core has no build output
// (its `build` script only typechecks).

export const APP_NAME = "Grouper";

export * from "./names";
export * from "./roster";
export * from "./rules";
export * from "./theme";
export * from "./storage";
export * from "./split";
export * from "./solver";
export * from "./groups";
export * from "./shuffle";
export * from "./layout";
export * from "./move";
export * from "./lock";
