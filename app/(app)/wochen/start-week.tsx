"use client";

import { CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { startLoop } from "@/lib/actions.ts";

/**
 * Eine Woche, die es noch nicht gibt, mit einem Tipp öffnen.
 *
 * Warum ein Knopf und kein Link: `/loop/<woche>` schickt zur Startseite
 * zurück, wenn es keinen Eintrag gibt — der Loop legt absichtlich keine Woche
 * still an. Also muss hier zuerst `startLoop` laufen. Das setzt `late` richtig,
 * weil `ensureEntry` beim Anlegen `week !== weekKey()` prüft; der Streak reißt
 * dadurch trotz Nachtrag (PRD 01).
 *
 * Immer "full", obwohl die Startseite zwei Knöpfe hat: in einer Liste wären
 * zwei Knöpfe pro Zeile Lärm, und "full" ist die verlustfreie Wahl. Jeder Schirm
 * außer den Prios lässt sich überspringen, das kostet einen Tipp; die
 * Kurzversion würde dagegen Fragen verstecken, die man vielleicht beantworten
 * wollte.
 */
export function StartWeek({
  week,
  label,
  hint,
  action,
  muted,
}: {
  week: string;
  label: string;
  hint: string;
  action: string;
  muted?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await startLoop("full", week);
          router.push(`/loop/${week}`);
        })
      }
      className="row row-inset w-full text-left"
    >
      <span
        className="icon-tile"
        style={{ background: muted ? "var(--label-3)" : "var(--c-blue)" }}
      >
        <Plus size={17} weight="bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-body block">{label}</span>
        <span className="t-footnote block text-[var(--label-2)]">{hint}</span>
      </span>
      <span className="t-footnote text-[var(--c-blue)]">
        {pending ? "…" : action}
      </span>
      <span aria-hidden className="text-[var(--label-3)]">
        <CaretRight size={14} weight="bold" />
      </span>
    </button>
  );
}
