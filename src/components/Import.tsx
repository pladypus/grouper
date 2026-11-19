import {
  CLASH_TITLE,
  clashMessage,
  IMPORT_ACCEPT,
  importClashes,
  importedMessage,
  nameListRoster,
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
import { ImportListDialog } from "./ImportListDialog";

/** A .txt / .csv list waiting for its confirm step. */
type NameListRead = Extract<ImportRead, { ok: true; kind: "names" }>;

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
 * A .txt / .csv name list first shows its confirm step (Roster name, column picker, Add names
 * preview), then joins at `add([roster])`, so it gets the same clash question and toast.
 */
export function useImport(onToast: (message: string) => void): ImportFlow {
  const { state, importRosters } = useRosters();
  const input = useRef<HTMLInputElement>(null);
  const [clash, setClash] = useState<{ rosters: readonly ImportedRoster[]; clashes: Roster[] } | null>(null);
  const [skipped, setSkipped] = useState<ImportedResult[] | null>(null);
  const [nameList, setNameList] = useState<NameListRead | null>(null);

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
    else if (read.kind === "names") setNameList(read);
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
      {nameList && (
        <ImportListDialog
          // A fresh confirm step (and column guess) for each file chosen.
          key={`${nameList.fileName}\n${nameList.text}`}
          text={nameList.text}
          fileName={nameList.fileName}
          defaultName={nameList.name}
          onImport={(name, names) => {
            setNameList(null);
            add([nameListRoster(name, names)]);
          }}
          onClose={() => setNameList(null)}
        />
      )}
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
