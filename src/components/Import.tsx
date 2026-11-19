import {
  CLASH_TITLE,
  clashMessage,
  IMPORT_ACCEPT,
  importClashes,
  importedMessage,
  NOT_GROUPER_FILE_MESSAGE,
  readImportFile,
  SKIPPED_TITLE,
  type ClashChoice,
  type ImportedResult,
  type ImportedRoster,
  type ImportRead,
  type Roster,
} from "../lib";
import { useRef, useState, type ReactNode } from "react";
import { useRosters } from "../state";
import { ClashDialog, ListDialog } from "./Dialog";

export interface ImportFlow {
  /** Opens the file picker (⋯ menu Import, the first-visit Import). */
  pick(): void;
  /** The hidden file input and whichever Import dialog is showing; render once. */
  element: ReactNode;
}

/**
 * Import (SPEC §12): file picker → `readImportFile` (the one file-type dispatch, in lib) → the
 * Replace / Keep both question if any names clash → add → success toast, then the skipped list.
 *
 * #22 (name lists) plugs in at `onRead`: a `kind: "names"` result shows its preview and then calls
 * `add([roster])`, which asks the same clash question.
 */
export function useImport(onToast: (message: string) => void): ImportFlow {
  const { state, importRosters } = useRosters();
  const input = useRef<HTMLInputElement>(null);
  const [clash, setClash] = useState<{ rosters: readonly ImportedRoster[]; clashes: Roster[] } | null>(null);
  const [skipped, setSkipped] = useState<ImportedResult[] | null>(null);

  const finish = (rosters: readonly ImportedRoster[], choice: ClashChoice) => {
    setClash(null);
    const imported = importRosters(rosters, choice);
    onToast(importedMessage(imported));
    const withSkips = imported.filter((r) => r.skipped.length > 0);
    if (withSkips.length > 0) setSkipped(withSkips);
  };

  /** Adds Rosters, asking first when any name is taken. */
  const add = (rosters: readonly ImportedRoster[]) => {
    const clashes = importClashes(state.app, rosters);
    if (clashes.length > 0) setClash({ rosters, clashes });
    else finish(rosters, "keep both");
  };

  const onRead = (read: ImportRead) => {
    if (!read.ok) onToast(read.message);
    else add(read.rosters);
  };

  const onFile = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      onToast(NOT_GROUPER_FILE_MESSAGE);
      return;
    }
    onRead(readImportFile({ name: file.name, text }));
  };

  const element = (
    <>
      <input
        ref={input}
        type="file"
        accept={IMPORT_ACCEPT}
        aria-label="Import file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same file again still fires a change.
          e.target.value = "";
          if (file) void onFile(file);
        }}
      />
      {clash && (
        <ClashDialog
          title={CLASH_TITLE}
          message={clashMessage(clash.clashes)}
          onReplace={() => finish(clash.rosters, "replace")}
          onKeepBoth={() => finish(clash.rosters, "keep both")}
          onClose={() => setClash(null)}
        />
      )}
      {skipped && (
        <ListDialog
          title={SKIPPED_TITLE}
          sections={skipped.map((r) => ({ heading: r.roster.name, lines: r.skipped }))}
          onClose={() => setSkipped(null)}
        />
      )}
    </>
  );

  return { pick: () => input.current?.click(), element };
}
