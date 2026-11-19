import {
  copiedPictureMessage,
  copiedTextMessage,
  COPY_FAILED_MESSAGE,
  FULL_SCREEN_FAILED_MESSAGE,
  groupsAsText,
  hasGroups,
  PICTURE_DOWNLOADED_MESSAGE,
  PICTURE_FAILED_MESSAGE,
  pictureFileName,
  pictureLayout,
  SHARE_NEEDS_GROUPS_MESSAGE,
} from "../lib";
import Copy from "lucide-react/icons/copy";
import ImageIcon from "lucide-react/icons/image";
import Maximize from "lucide-react/icons/maximize";
import Minimize from "lucide-react/icons/minimize";
import Printer from "lucide-react/icons/printer";
import Share from "lucide-react/icons/share";
import { useEffect, useState } from "react";
import { copyPng, copyText } from "../clipboard";
import { downloadBlob } from "../download";
import { drawPicture, pngBlob } from "../picture";
import { useRosters } from "../state";
import { Menu, type MenuItem } from "./Menu";

const triggerClass =
  "inline-flex items-center gap-[7px] rounded-lg border border-line bg-panel px-3 py-[7px] font-semibold hover:border-mute disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line";

/** Whether the page is in browser full screen; follows Esc and the browser's own controls. */
function useFullScreen(): boolean {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return on;
}

/**
 * spec: share.md and screens.md#top-bar-one-row-fixed-height item 5: Share, disabled until there are Groups. Each action is one row in
 * `items`.
 */
export function ShareMenu({ onToast }: { onToast: (message: string) => void }) {
  const { roster, state } = useRosters();
  const { board } = state;
  const fullScreen = useFullScreen();
  const enabled = !!roster && hasGroups(board);

  const items: MenuItem[] = [
    {
      id: "copy-picture",
      label: "Copy picture",
      hint: "A 16:9 picture of the Groups, for a slide",
      icon: ImageIcon,
      onSelect() {
        if (!roster) return;
        const now = new Date();
        // Drawn and handed to the clipboard synchronously, inside the click (Safari's rule).
        const canvas = drawPicture((measure) => pictureLayout(board, roster, now, measure));
        if (!canvas) return onToast(PICTURE_FAILED_MESSAGE);
        const png = pngBlob(canvas);
        void copyPng(png).then(async (copied) => {
          if (copied) return onToast(copiedPictureMessage(board));
          try {
            downloadBlob(pictureFileName(roster, now), await png);
            onToast(PICTURE_DOWNLOADED_MESSAGE);
          } catch {
            onToast(PICTURE_FAILED_MESSAGE);
          }
        });
      },
    },
    {
      id: "copy-text",
      label: "Copy as text",
      hint: "“Group 1: Ana, Dee, Eli” lines",
      icon: Copy,
      async onSelect() {
        if (!roster) return;
        const copied = await copyText(groupsAsText(board, roster, new Date()));
        onToast(copied ? copiedTextMessage(board) : COPY_FAILED_MESSAGE);
      },
    },
    {
      id: "print",
      label: "Print…",
      icon: Printer,
      separatorBefore: true,
      onSelect: () => window.print(),
    },
    fullScreen
      ? { id: "full-screen", label: "Exit full screen", icon: Minimize, onSelect: () => void document.exitFullscreen?.() }
      : {
          id: "full-screen",
          label: "Full screen",
          hint: "For the projector; Esc to leave",
          icon: Maximize,
          onSelect() {
            // The whole page, top bar included (spec: share.md).
            const request = document.documentElement.requestFullscreen?.();
            if (!request) onToast(FULL_SCREEN_FAILED_MESSAGE);
            else request.catch(() => onToast(FULL_SCREEN_FAILED_MESSAGE));
          },
        },
  ];

  return (
    <Menu
      label="Share"
      items={items}
      disabled={!enabled}
      title={enabled ? undefined : SHARE_NEEDS_GROUPS_MESSAGE}
      align="right"
      triggerClass={triggerClass}
      trigger={
        <>
          <Share aria-hidden="true" className="size-[18px] flex-none" />
          Share
        </>
      }
    />
  );
}
