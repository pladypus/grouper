import {
  groupSizeLabel,
  groupTitle,
  nameColumns,
  nameFontSize,
  PHONE_NAME_FONT_SIZE,
  type Group,
  type MemberView,
} from "@grouper/core";
import { useId, type CSSProperties } from "react";

export interface GroupCardProps {
  group: Group;
  index: number;
  members: readonly MemberView[];
  /** Card size from boardLayout, or null when unmeasured / on phones (the card sizes itself). */
  size: { width: number; height: number } | null;
  phone: boolean;
}

/** The Group's own colour, from --hue and the theme's --hue-s / --hue-l (styles.css). */
const hueBg = "bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))]";

/** SPEC §8 Group card: coloured header "Group 1 · 4 students", names sized to fit the card. */
export function GroupCard({ group, index, members, size, phone }: GroupCardProps) {
  const headingId = useId();
  const n = members.length;
  const columns = phone || !size ? 1 : nameColumns(n, size.width, size.height);
  const fontSize = phone
    ? PHONE_NAME_FONT_SIZE
    : nameFontSize({ cardWidth: size?.width ?? 0, cardHeight: size?.height ?? 0, memberCount: n, columns });
  const style = { "--hue": group.hue, ...(size && !phone ? { width: size.width, height: size.height } : {}) } as CSSProperties;

  const listClass = phone
    ? "flex flex-col gap-1 px-3 py-2.5"
    : columns === 2
      ? "grid min-h-0 flex-1 grid-cols-2 content-center gap-x-3 gap-y-1 overflow-hidden px-3 py-2.5"
      : "flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-hidden px-3 py-2.5";

  return (
    <section
      aria-labelledby={headingId}
      style={style}
      className={`flex flex-none flex-col overflow-hidden rounded-[14px] border border-line bg-panel shadow-[0_1px_3px_rgba(0,0,0,.08)]${phone ? " w-full" : ""}`}
    >
      {/* A div, not <header>: jsdom and some screen readers would count it as another banner. */}
      <div className={`flex items-center gap-2.5 py-2.5 pl-4 pr-3 text-on-c ${hueBg}`}>
        <h2 id={headingId} className="text-[clamp(17px,1.5vw,24px)] font-extrabold tracking-[.01em]">
          {groupTitle(index)} <span className="text-sm font-semibold opacity-85">· {groupSizeLabel(group)}</span>
        </h2>
      </div>
      <ul className={listClass} style={{ fontSize }}>
        {members.map((m) => (
          <li
            key={m.id}
            className={`flex min-w-0 items-center gap-3 rounded-[10px] px-[.45em] py-[.22em] font-medium leading-[1.2]${
              phone ? " min-h-11" : ""
            }${m.faded ? " text-mute line-through" : ""}`}
          >
            <span aria-hidden="true" className={`size-2.5 flex-none rounded-full ${hueBg}`} />
            <span className="min-w-0 truncate">{m.name}</span>
            {m.faded && <span className="sr-only">{m.status === "absent" ? " (Absent)" : " (removed)"}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
