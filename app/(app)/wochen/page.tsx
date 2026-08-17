import {
  CaretRight,
  CheckCircle,
  CircleDashed,
  CircleHalf,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { requirePerson } from "@/lib/auth.ts";
import { type WeekRow, loadMyWeeks } from "@/lib/weeks-index.ts";
import { parseWeekKey, weekLabel, weekRangeLabel } from "@/lib/week.ts";
import { StartWeek } from "./start-week.tsx";

export const dynamic = "force-dynamic";

/**
 * Die Liste der eigenen Wochen.
 *
 * PRD 01 sagt, eine vergangene Woche bleibe nachträglich füllbar, und die Spalte
 * `entry.late` zieht daraus schon die Streak-Konsequenz — es gab bisher nur
 * keinen Weg, eine vergangene Woche überhaupt zu erreichen. Das ist dieser Weg.
 *
 * Vom Partner steht hier nichts. Nicht sein Status, nicht sein Score. Warum:
 * `../../../lib/weeks-index.ts`.
 */
export default async function WeeksPage() {
  const { me } = await requirePerson();
  const weeks = await loadMyWeeks(me.id);
  const nothingFilled = weeks.every((row) => row.status === "none");

  // Nach ISO-Jahr gruppiert, wie Health seine Verläufe nach Zeitraum trennt.
  // Ab dem zweiten Jahr ist es die Orientierung, die eine lange Liste braucht.
  const years: Array<{ year: number; rows: WeekRow[] }> = [];
  for (const row of weeks) {
    const { year } = parseWeekKey(row.week);
    const last = years[years.length - 1];
    if (last?.year === year) last.rows.push(row);
    else years.push({ year, rows: [row] });
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <header className="px-1">
        <h1 className="t-large-title">Wochen</h1>
        <p className="t-subhead mt-1 text-[var(--label-2)]">
          Eine vergangene Woche kannst du nachtragen. Für den Streak zählt sie
          dann nicht mehr.
        </p>
      </header>

      {nothingFilled && (
        <p className="t-footnote px-4 text-[var(--label-2)]">
          Sobald du deine erste Woche abgegeben hast, wächst diese Liste nach
          unten.
        </p>
      )}

      {years.map(({ year, rows }) => (
        <section key={year}>
          {years.length > 1 && <h2 className="group-title">{year}</h2>}
          <div className="list">
            {rows.map((row) => (
              <WeekEntry key={row.week} row={row} />
            ))}
          </div>
        </section>
      ))}

      {/* Die Kalenderdatei (PRD 07, Teil B, Stufe 1) steht im Fundament: sie
          wird einmal eingerichtet und danach nie wieder angefasst, und das ist
          die Seite für genau solche Dinge. Diese Liste ist zum Blättern. */}
    </div>
  );
}

/** Wie eine Woche in der Liste aussieht, je nach Zustand. */
const LOOK = {
  submitted: {
    color: "var(--c-prios)",
    Icon: CheckCircle,
    text: "abgegeben",
  },
  part1: {
    color: "var(--c-blue)",
    Icon: CircleHalf,
    text: "Rückblick abgegeben",
  },
  draft: {
    color: "var(--c-blue)",
    Icon: CircleDashed,
    text: "angefangen",
  },
} as const;

function WeekEntry({ row }: { row: WeekRow }) {
  const label = weekLabel(row.week);
  const range = weekRangeLabel(row.week);

  // Ohne Eintrag gibt es nichts zu öffnen — die Woche muss erst angelegt
  // werden, und das ist eine Server-Aktion und kein Link.
  if (row.status === "none") {
    return (
      <StartWeek
        week={row.week}
        label={label}
        hint={`${range} · ${row.current ? "offen" : "nicht gefüllt"}`}
        action={row.current ? "Starten" : "Nachtragen"}
        muted={!row.current}
      />
    );
  }

  const { color, Icon, text } = LOOK[row.status];

  // "abgegeben · nachgetragen" wäre doppelt und bricht auf dem Telefon in die
  // zweite Zeile. Nachgetragen heißt hier abgegeben, nur eben zu spät.
  const detail =
    row.late && row.status === "submitted"
      ? "nachgetragen"
      : row.late
        ? `${text} · nachgetragen`
        : text;

  return (
    <Link href={`/loop/${row.week}`} className="row row-inset">
      <span className="icon-tile" style={{ background: color }}>
        <Icon size={17} weight="fill" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-body block">{label}</span>
        <span className="t-footnote block text-[var(--label-2)]">
          {range} · {detail}
        </span>
      </span>
      {row.lifescore !== null && (
        <span className="t-metric text-[17px]">{row.lifescore}</span>
      )}
      <span aria-hidden className="text-[var(--label-3)]">
        <CaretRight size={14} weight="bold" />
      </span>
    </Link>
  );
}
