// Framework-free domain code shared by apps/react and apps/svelte.
// Exported straight from source: each app's Vite and Vitest compile it, so core has no build output
// (its `build` script only typechecks).

export const APP_NAME = "Grouper";

export * from "./names";
export * from "./roster";
export * from "./theme";
export * from "./storage";
