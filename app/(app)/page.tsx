import {
  Check,
  Compass,
  Flag,
  Flame,
  Minus,
  PencilSimple,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { requirePerson } from "@/lib/auth.ts";
import { loadHome } from "@/lib/data.ts";
import { type EntryStatus, statusLabel } from "@/lib/sharing.ts";
import { TZ, weekLabel, weekRangeLabel } from "@/lib/week.ts";
import { StartLoop } from "./start-loop.tsx";
import { Group, HintRow, Tile } from "./ui.tsx";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { me, partner } = await requirePerson();
  const home = await loadHome(me, partner);

  // Ohne Fundament fehlt dem Werte-Check die Grundlage. Einmal hierhin führen,
  // danach nie wieder ungefragt (PRD 03).
  if (home.needsFoundation) {
    return (
      <div className="flex flex-col gap-6 pt-10">
        <Tile color="var(--c-values)">
          <Compass size={17} weight="fill" />
        </Tile>
        <div className="flex flex-col gap-2">
          <h1 className="t-large-title">Zuerst dein Fundament</h1>
          <p className="t-body text-[var(--label-2)]">
            Drei Werte, gegen die du deine Wochen misst. Das dauert zwei Minuten
            und passiert genau einmal.
          </p>
        </div>
        <Link
          href="/fundament"
          className="btn btn-filled w-full sm:max-w-[320px]"
        >
          Werte festlegen
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="flex items-start justify-between gap-4 pt-2">
        <div>
          <h1 className="t-large-title">{weekLabel(home.week)}</h1>
          <p className="t-subhead text-[var(--label-2)]">
            {weekRangeLabel(home.week)}
          </p>
        </div>
        {home.me.streak > 0 && <Streak weeks={home.me.streak} />}
      </header>

      {/* Der eine Knopf, der in die erste Frage führt. Kein Zwischenschirm
          (PRD 01). */}
      <StartLoop week={home.week} status={home.me.status} />

      {/* Peer Pressure: der Status, ohne einen Inhalt zu verraten (PRD 02).
          Diese Karte darf nie einen Score, eine Prio oder einen Text des
          Partners zeigen — nur Name, Zustand, Zeitpunkt. */}
      <Group title="Diese Woche">
        <div className="list">
          <StatusRow name="Du" status={home.me.status} />
          {home.partner ? (
            <StatusRow
              name={home.partner.name}
              status={home.partner.status}
              at={home.partner.at}
            />
          ) : (
            <HintRow>Kein Partner verknüpft.</HintRow>
          )}
        </div>
      </Group>

      <div className="grid gap-7 xl:grid-cols-2">
        <Group title="Letzte Woche wolltest du">
          <div className="list">
            {home.lastWeekPrios.length > 0 ? (
              home.lastWeekPrios.map((prio, index) => (
                <div key={prio.id} className="row row-inset">
                  <Tile color="var(--c-prios)">
                    <span className="t-metric text-[13px]">{index + 1}</span>
                  </Tile>
                  <span className="t-body">{prio.text}</span>
                </div>
              ))
            ) : (
              <HintRow>
                Aus der Vorwoche steht noch nichts da. Die Prios aus diesem Loop
                stehen nächste Woche hier.
              </HintRow>
            )}
          </div>
        </Group>

        <Group title="Dieses Jahr">
          <div className="list">
            {home.goals.length > 0 ? (
              home.goals.map((goal) => (
                <div key={goal.id} className="row row-inset">
                  <Tile color="var(--c-self)">
                    <Flag size={15} weight="fill" />
                  </Tile>
                  <span className="t-body">{goal.label}</span>
                </div>
              ))
            ) : (
              <Link href="/fundament" className="row row-inset">
                <Tile color="var(--c-self)">
                  <Flag size={15} weight="fill" />
                </Tile>
                <span className="t-body flex-1">Jahresziele festlegen</span>
                <span className="t-subhead text-[var(--label-3)]">
                  Fundament
                </span>
              </Link>
            )}
          </div>
        </Group>
      </div>
    </div>
  );
}

/**
 * Der Streak. Der einzige Zahlenwert, der ohne Klick sichtbar ist (PRD 04).
 *
 * Bei 0 steht hier nichts: "0 Wochen in Folge" ist keine Information, sondern
 * ein Vorwurf, und die Zeile daneben sagt ohnehin schon, dass die Woche offen
 * ist.
 */
function Streak({ weeks }: { weeks: number }) {
  return (
    <div className="flex flex-col items-end">
      <span className="flex items-center gap-1">
        <Flame size={20} weight="fill" color="var(--c-work)" />
        <span className="t-metric text-[22px] leading-[28px]">{weeks}</span>
      </span>
      <span className="t-caption text-[var(--label-2)]">
        {weeks === 1 ? "Woche in Folge" : "Wochen in Folge"}
      </span>
    </div>
  );
}

/**
 * Die farbige Kachel ist der Zustand, nicht Deko: sie trägt dieselbe Aussage
 * wie der Text rechts und macht die Zeile scanbar, so wie Health seine
 * Kategorien scanbar macht. Deshalb Glyphe plus Farbe und kein Punkt.
 */
const STATE = {
  none: { color: "var(--label-3)", icon: Minus },
  draft: { color: "var(--c-work)", icon: PencilSimple },
  part1: { color: "var(--c-blue)", icon: Check },
  submitted: { color: "var(--c-prios)", icon: Check },
} as const satisfies Record<EntryStatus, { color: string; icon: typeof Check }>;

function StatusRow({
  name,
  status,
  at,
}: {
  name: string;
  status: EntryStatus;
  at?: number | null;
}) {
  const state = STATE[status];
  return (
    <div className="row row-inset">
      <Tile color={state.color}>
        <state.icon size={15} weight="bold" />
      </Tile>
      <span className="t-body flex-none">{name}</span>
      <span className="t-subhead ml-auto text-right text-[var(--label-2)]">
        {statusLabel(status)}
        {at !== null && at !== undefined && (
          <>
            {" · "}
            {stamp(at)}
          </>
        )}
      </span>
    </div>
  );
}

/** `Do 21:40` — die Form aus PRD 02. Immer Berliner Zeit, wie alles hier. */
function stamp(unix: number): string {
  const parts = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).formatToParts(new Date(unix * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday").replace(".", "")} ${get("hour")}:${get("minute")}`;
}
