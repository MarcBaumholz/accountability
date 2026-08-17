import {
  Briefcase,
  ChartLine,
  Gauge,
  Heart,
  SunHorizon,
  User,
} from "@phosphor-icons/react/dist/ssr";

import { requirePerson } from "@/lib/auth.ts";
import { loadHistory, weekSpanAll } from "@/lib/data.ts";
import { Group, Tile } from "../ui.tsx";
import { RateBar, type Series, TrendChart } from "./chart.tsx";
import { SpanPicker } from "./span-picker.tsx";

export const dynamic = "force-dynamic";

/**
 * Die Kategoriefarben, wie auf der Startseite.
 *
 * Innerhalb einer Karte ist jede Linie eine andere Farbe; zwischen Karten
 * wiederholen sich Farben, weil jede Karte ihre eigene Legende hat. Das ist
 * dieselbe Regel, mit der Health seine Systemfarben über viele Karten verteilt.
 */
const AREA_COLORS = [
  "var(--c-work)",
  "var(--c-leisure)",
  "var(--c-self)",
] as const;
const VALUE_COLORS = [
  "var(--c-values)",
  "var(--c-prios)",
  "var(--c-blue)",
] as const;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ span?: string }>;
}) {
  const { span: spanParam = "8" } = await searchParams;
  const { me, partner } = await requirePerson();

  const span =
    spanParam === "all"
      ? await weekSpanAll(me.id)
      : Number(spanParam) === 26
        ? 26
        : 8;

  const history = await loadHistory(me, partner, span);
  const filled = history.mine.filter((p) => p.lifescore !== null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 pt-2">
        <h1 className="t-large-title">Verlauf</h1>
        <SpanPicker value={spanParam} />
      </header>

      <div className="grid gap-7 xl:grid-cols-2">
        {/* Leer ist der Normalfall der ersten Wochen — er muss gut aussehen und
            darf kein leeres Diagrammgerüst zeigen (PRD 04). */}
        {filled.length === 0 ? (
          <div className="list flex flex-col items-center gap-2 px-6 py-12 text-center xl:col-span-2">
            <ChartLine size={30} weight="regular" color="var(--label-3)" />
            <p className="t-headline">Noch keine Kurve</p>
            <p className="t-subhead max-w-[34ch] text-[var(--label-2)]">
              Nach deinem ersten Loop entsteht hier eine Kurve.
            </p>
          </div>
        ) : filled.length === 1 ? (
          <SingleWeek point={filled[0]} values={history.values} />
        ) : (
          <>
            <Group
              title="Lifescore"
              note={
                history.partnerLifescores
                  ? `${history.partnerName} erscheint in Wochen, in denen ihr beide abgegeben habt.`
                  : undefined
              }
            >
              <div className="list p-4">
                <TrendChart
                  weeks={history.weeks}
                  min={1}
                  max={10}
                  unit="von 10"
                  series={[
                    {
                      label: "Du",
                      color: "var(--c-blue)",
                      points: history.mine.map((p) => p.lifescore),
                    },
                    ...(history.partnerLifescores
                      ? [
                          {
                            label: history.partnerName ?? "Partner",
                            color: "var(--c-values)",
                            points: history.partnerLifescores,
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </Group>

            <Group title="Bereiche" note="Wo die Gesamtzahl herkommt.">
              <div className="list p-4">
                <TrendChart
                  weeks={history.weeks}
                  min={1}
                  max={10}
                  unit="von 10"
                  series={[
                    {
                      label: "Arbeit",
                      color: AREA_COLORS[0],
                      points: history.mine.map((p) => p.satWork),
                    },
                    {
                      label: "Freizeit",
                      color: AREA_COLORS[1],
                      points: history.mine.map((p) => p.satLeisure),
                    },
                    {
                      label: "Selbst",
                      color: AREA_COLORS[2],
                      points: history.mine.map((p) => p.satSelf),
                    },
                  ]}
                />
              </div>
            </Group>

            {history.values.length > 0 && (
              <Group title="Werte">
                <div className="list p-4">
                  <TrendChart
                    weeks={history.weeks}
                    min={1}
                    max={5}
                    unit="von 5"
                    series={history.values.map(
                      (value, index): Series => ({
                        label: value.active
                          ? value.label
                          : `${value.label} (beendet)`,
                        color: VALUE_COLORS[index % VALUE_COLORS.length],
                        points: history.mine.map(
                          (p) => p.valueScores[value.id] ?? null,
                        ),
                      }),
                    )}
                  />
                </div>
              </Group>
            )}
          </>
        )}

        {history.prioRate.total > 0 && (
          <Group title="Prios" note="Über den gewählten Zeitraum.">
            <div className="list p-4">
              <RateBar {...history.prioRate} />
            </div>
          </Group>
        )}
      </div>
    </div>
  );
}

/** Eine Linie mit einem Punkt ist eine Lüge — bei einer Woche nur Zahlen. */
function SingleWeek({
  point,
  values,
}: {
  point: {
    lifescore: number | null;
    satWork: number | null;
    satLeisure: number | null;
    satSelf: number | null;
    valueScores: Record<string, number>;
  };
  values: Array<{ id: string; label: string }>;
}) {
  return (
    <Group
      title="Deine erste Woche"
      note="Ab der zweiten Woche wird daraus eine Kurve."
      className="xl:col-span-2"
    >
      <dl className="list">
        <ValueRow
          label="Lifescore"
          value={point.lifescore}
          of={10}
          color="var(--c-blue)"
          icon={<Gauge size={15} weight="fill" />}
        />
        <ValueRow
          label="Arbeit"
          value={point.satWork}
          of={10}
          color="var(--c-work)"
          icon={<Briefcase size={15} weight="fill" />}
        />
        <ValueRow
          label="Freizeit"
          value={point.satLeisure}
          of={10}
          color="var(--c-leisure)"
          icon={<SunHorizon size={15} weight="fill" />}
        />
        <ValueRow
          label="Selbst"
          value={point.satSelf}
          of={10}
          color="var(--c-self)"
          icon={<User size={15} weight="fill" />}
        />
        {values.map((value, index) => (
          <ValueRow
            key={value.id}
            label={value.label}
            value={point.valueScores[value.id] ?? null}
            of={5}
            color={VALUE_COLORS[index % VALUE_COLORS.length]}
            icon={<Heart size={15} weight="fill" />}
          />
        ))}
      </dl>
    </Group>
  );
}

function ValueRow({
  label,
  value,
  of,
  color,
  icon,
}: {
  label: string;
  value: number | null;
  of: number;
  color: string;
  icon: React.ReactNode;
}) {
  if (value === null) return null;
  return (
    <div className="row row-inset">
      <Tile color={color}>{icon}</Tile>
      <dt className="t-body flex-1">{label}</dt>
      <dd className="t-metric text-[17px]" style={{ color }}>
        {value}
        <span className="t-subhead text-[var(--label-3)]">/{of}</span>
      </dd>
    </div>
  );
}
