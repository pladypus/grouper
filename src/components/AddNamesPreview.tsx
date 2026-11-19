import { blankLinesLabel, LOOKS_LIKE_SENTENCE_MESSAGE, skippedReasonLabel, type NamePreview } from "../lib";
import TriangleAlert from "lucide-react/icons/triangle-alert";

export interface AddNamesPreviewProps {
  /** From previewNames (or useNameList). */
  preview: NamePreview;
  /** Name keys the Teacher unticked; every other name is ticked. */
  unticked: ReadonlySet<string>;
  onToggle: (key: string) => void;
}

/**
 * spec: add-names.md preview: a checkbox per new name (ticked by default, long lines flagged "looks like a
 * sentence?"), then the Skipped list. The submit button ("Add N students" / "Create") is the parent's.
 */
export function AddNamesPreview({ preview, unticked, onToggle }: AddNamesPreviewProps) {
  const { names, skipped, blankLines } = preview;
  const ticked = names.filter((n) => !unticked.has(n.key)).length;
  return (
    <div className="my-2.5">
      <h3 className="text-sm font-semibold">
        {names.length === 0 ? "No new names" : `New names (${ticked} of ${names.length} ticked)`}
      </h3>
      {names.length > 0 && (
        <ul aria-label="New names" className="mt-1 max-h-64 overflow-auto rounded-lg border border-line">
          {names.map((n) => (
            <li key={n.key} className="border-b border-line last:border-b-0">
              <label className="flex items-start gap-2 px-2 py-1.5">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!unticked.has(n.key)}
                  onChange={() => onToggle(n.key)}
                />
                <span className="min-w-0 flex-1 break-words">
                  {n.name}
                  {n.flagged && (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-sm text-warn">
                      <TriangleAlert aria-hidden="true" className="size-3.5" />
                      {LOOKS_LIKE_SENTENCE_MESSAGE}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {(skipped.length > 0 || blankLines > 0) && (
        <section aria-label="Skipped" className="mt-2.5">
          <h3 className="text-sm font-semibold">Skipped</h3>
          <ul className="mt-1 text-sm text-mute">
            {skipped.map((s, i) => (
              <li key={i}>
                {s.name} ({skippedReasonLabel(s.reason)})
              </li>
            ))}
            {blankLines > 0 && <li>{blankLinesLabel(blankLines)}</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
