import { CalendarPlus, CaretRight } from "@phosphor-icons/react/dist/ssr";

import { requirePerson } from "@/lib/auth.ts";
import { activeValues, goalsOf } from "@/lib/data.ts";
import { Group, Tile } from "../ui.tsx";
import { FoundationForm } from "./foundation-form.tsx";

export const dynamic = "force-dynamic";

/**
 * Die Seite bleibt eine Spalte, auch auf 1440 px.
 *
 * Ein Formular wird von einer zweiten Spalte nicht besser: die Felder gehören in
 * eine Leserichtung, und ein 900 px breites Textfeld für ein Wort wie
 * "Gesundheit" sieht falsch aus. Die überschüssige Breite trägt hier die
 * Seitenleiste, nicht der Inhalt.
 */
export default async function FoundationPage() {
  const { me } = await requirePerson();
  const [values, goals] = await Promise.all([
    activeValues(me.id),
    goalsOf(me.id),
  ]);

  return (
    <div className="lg:max-w-[560px]">
      <header className="flex flex-col gap-1 pt-2 pb-6">
        <h1 className="t-large-title">Fundament</h1>
        <p className="t-subhead text-[var(--label-2)]">
          Werte, Ziele und der Termin. Einmal einrichten, selten ändern.
        </p>
      </header>

      <FoundationForm
        firstRun={values.length === 0}
        initialValues={values.map((v) => ({
          id: v.id,
          label: v.label,
          description: v.description ?? "",
        }))}
        initialGoals={goals.map((g) => g.label)}
      />

      {/*
        Die Kalenderdatei (PRD 07, Teil B, Stufe 1).

        Sie steht hier und nicht in der Wochenliste, weil sie dieselbe Art Sache
        ist wie die Werte: einmal einrichten, danach nie wieder anfassen. Auf
        "Wochen" würde niemand danach suchen — das ist die Seite zum Blättern.
      */}
      <Group
        title="Wochentermin"
        note="Sonntag 19:00, jede Woche. Einmal importieren, dann steht der Termin."
        className="pt-7"
      >
        <div className="list">
          <a href="/kalender.ics" className="row row-inset">
            <Tile color="var(--c-leisure)">
              <CalendarPlus size={15} weight="fill" />
            </Tile>
            <span className="t-body flex-1">Termin in den Kalender</span>
            <span aria-hidden className="text-[var(--label-3)]">
              <CaretRight size={14} weight="bold" />
            </span>
          </a>
        </div>
      </Group>
    </div>
  );
}
