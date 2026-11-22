import { useId } from "react";
import CodeXml from "lucide-react/icons/code-xml";
import ShieldCheck from "lucide-react/icons/shield-check";
import X from "lucide-react/icons/x";
import { BUILD_INFO, REPO_URL, formatBuildDate, type BuildInfo } from "../buildInfo";
import { Modal } from "./Dialog";

export interface AboutDialogProps {
  onClose: () => void;
  /** Which build is running; tests pass a fixed one. */
  build?: BuildInfo;
}

const focusRing =
  "rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const NEW_TAB = " (opens in a new tab)";

/**
 * About Grouper, from the ⋯ menu (spec: screens.md#about-66). Everything is centred. A ✕ in the top-right corner,
 * Esc or a click outside closes it (the Modal focuses itself so Esc works straight away).
 */
export function AboutDialog({ onClose, build = BUILD_INFO }: AboutDialogProps) {
  // Announced with the subtitle when the dialog opens: the reassurance a Teacher most needs.
  const privacyId = useId();
  return (
    <Modal
      title="Grouper"
      srTitle="About Grouper"
      subtitle="Random student groups for teachers."
      describedBy={privacyId}
      narrow
      onClose={onClose}
      icon={<img src="/icon.svg" alt="" width={48} height={48} className="size-12 flex-none" />}
    >
      {/* Pinned to the panel's top-right corner (the Modal panel is `relative`); styled like the iOS tip's dismiss ✕. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`${focusRing} absolute right-3 top-3 grid size-9 place-items-center rounded-md text-mute hover:bg-bg hover:text-ink`}
      >
        <X aria-hidden="true" className="size-5" />
      </button>
      <p
        id={privacyId}
        className="mx-auto flex w-fit max-w-full items-center gap-2.5 rounded-md border border-ok-line bg-ok-soft px-3.5 py-2.5 text-sm text-ink"
      >
        <ShieldCheck aria-hidden="true" className="size-4 flex-none text-ok" />
        <span>
          <span className="block">Class lists stay in this browser.</span>
          <span className="block">Nothing is sent to a server.</span>
        </span>
      </p>
      <div className="mt-5 flex flex-col items-center gap-1 border-t border-line pt-5 text-center">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${focusRing} group inline-flex min-h-6 items-center gap-1.5 font-medium text-accent`}
        >
          <CodeXml aria-hidden="true" className="size-4 flex-none" />
          <span className="underline decoration-accent/40 underline-offset-2 group-hover:decoration-accent">
            Source code on GitHub
          </span>
          <span aria-hidden="true" className="-ml-0.5 text-[0.9em]">
            ↗
          </span>
          <span className="sr-only">{NEW_TAB}</span>
        </a>
        <p className="text-sm text-mute">
          <span className="whitespace-nowrap">
            Version{" "}
            {build.commit ? (
              <a
                href={`${REPO_URL}/commit/${build.commit}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Commit ${build.commit} on GitHub${NEW_TAB}`}
                className={`${focusRing} -my-1.5 inline-block py-1.5 align-baseline font-mono text-[0.95em] underline decoration-mute underline-offset-2 hover:text-accent hover:decoration-accent`}
              >
                {build.commit}
              </a>
            ) : (
              "dev"
            )}
          </span>{" "}
          ·{" "}
          <span className="sr-only">built </span>
          <time dateTime={build.date} className="whitespace-nowrap">
            {formatBuildDate(build.date)}
          </time>
        </p>
      </div>
    </Modal>
  );
}
