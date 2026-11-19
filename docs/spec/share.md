# Share, print, copy, full screen (#9)

The [`archive/prototype/print-copy`](https://github.com/pladypus/grouper/tree/archive/prototype/print-copy) tag is the reference (`?variant=A` with C's Copy picture; `?print` for the print layout).

**Share** menu:
- **Copy picture:** a 16:9 PNG (1920×1080) of the Groups, always light whatever the theme: title "Period 2 groups", the date, and coloured Group cards laid out like the board with names sized to fit. Drawn to a canvas and written with `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])`; if that isn't available or fails, the PNG downloads as `Period 2 groups YYYY-MM-DD.png`.
- **Copy as text:** plain text:
  ```
  Period 2 groups, 18 Nov 2026
  Group 1: Ana, Dee, Eli, Ben
  Group 2: …
  ```
- **Print…:** opens the browser's print dialog.
- **Full screen:** browser full screen (`requestFullscreen`), top bar included; Esc leaves.
- After a copy, a toast says what was copied: "Copied a picture of 5 Groups. Paste it into your slide." / "Copied 5 Groups as text."

**Print layout** (`@media print`, also via Ctrl+P), A4 portrait, light ink on white with Group colours kept:
- Header: "<Roster> groups", the date, the number of Students.
- Group cards three across, coloured header, names about 14 pt; `break-inside: avoid`.
- Hidden: top bar, notices, drawers, unpressed Lock buttons. A Locked Group keeps its "Locked" pill.

No separate projector or present mode.
