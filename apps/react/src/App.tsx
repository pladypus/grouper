import { APP_NAME } from "@grouper/core";
// Per-icon import: the package barrel makes Vite and Vitest compile every icon.
import Shuffle from "lucide-react/icons/shuffle";

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="flex items-center gap-3 text-5xl font-bold">
        <Shuffle aria-hidden="true" className="size-10" />
        {APP_NAME}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">React app placeholder.</p>
    </main>
  );
}
