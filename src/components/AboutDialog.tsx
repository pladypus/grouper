import { useId } from "react";
import CodeXml from "lucide-react/icons/code-xml";
import ShieldCheck from "lucide-react/icons/shield-check";
import { BUILD_INFO, REPO_URL, formatBuildDate, type BuildInfo } from "../buildInfo";
import { Modal, primaryClass } from "./Dialog";

export interface AboutDialogProps {
  onClose: () => void;
  /** Which build is running; tests pass a fixed one. */
  build?: BuildInfo;
}

const focusRing =
  "rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const NEW_TAB = " (opens in a new tab)";

/** About Grouper, from the ⋯ menu (spec: screens.md#about-66). */
export function AboutDialog({ onClose, build = BUILD_INFO }: AboutDialogProps) {
  // Announced with the subtitle when the dialog opens: the reassurance a Teacher most needs.
  const privacyId = useId();
  return (
    <Modal
      title="About Grouper"
      subtitle="Random student groups for teachers."
      describedBy={privacyId}
      narrow
      onClose={onClose}
      icon={<img src="/icon.svg" alt="" width={40} height={40} className="size-10 flex-none max-[359px]:mt-0.5" />}
    >
      {/* 1px border + 11px padding + half the 16px shield puts the shield's centre under the 40px app icon's (20px);
          1 + 11 + 16 + 24px gap starts the text under the title (40px icon + 12px gap). Below 360px it tightens so the lines don't wrap. */}
      <p
        id={privacyId}
        className="flex w-fit max-w-full items-start gap-6 rounded-md border border-ok-line bg-ok-soft py-2.5 pl-[11px] pr-4 text-sm text-ink max-[359px]:gap-2 max-[359px]:pl-3 max-[359px]:pr-3"
      >
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 flex-none text-ok" />
        <span>
          <span className="block">Class lists stay in this browser.</span>
          <span className="block">Nothing is sent to a server.</span>
        </span>
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line pt-5">
        <div className="flex min-w-0 flex-col gap-1">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${focusRing} group inline-flex min-h-6 items-center gap-1.5 self-start font-medium text-accent`}
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
        <button type="button" className={`${primaryClass} ml-auto`} onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </Modal>
  );
}
