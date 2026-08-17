import {
  Briefcase,
  CheckCircle,
  MinusCircle,
  SunHorizon,
  User,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";

import type { Part1View, Part2View } from "@/lib/data.ts";

const RESULT = {
  done: { label: "Erreicht", color: "var(--c-prios)", Icon: CheckCircle },
  partly: { label: "Teilweise", color: "var(--c-work)", Icon: MinusCircle },
  missed: { label: "Nicht", color: "var(--label-3)", Icon: XCircle },
} as const;

/**
 * Die Woche des Partners, so weit sie freigegeben ist.
 *
 * Die Komponente entscheidet nichts über Sichtbarkeit, sie rendert nur, was ihr
 * gegeben wird. Die Freigabe fällt in `loadPartnerView`, damit eine vergessene
 * Bedingung hier keinen Inhalt durchlassen kann, den es nicht geben dürfte.
 */
export function PartnerCard({
  name,
  part1,
  part2,
  noteToMe,
}: {
  name: string;
  part1: Part1View;
  part2?: Part2View;
  noteToMe?: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Der Lifescore als große Zahl, wie ein Health-Messwert. */}
      <div className="list">
        <div className="row row-inset">
          <span className="t-headline flex-1">{name}</span>
          {part1.lifescore !== null && (
            <span className="flex items-baseline gap-1">
              <span className="t-metric text-[28px]">{part1.lifescore}</span>
              <span className="t-footnote text-[var(--label-2)]">von 10</span>
            </span>
          )}
        </div>

        <Area
          label="Arbeit"
          value={part1.satWork}
          color="var(--c-work)"
          icon={<Briefcase size={17} weight="fill" />}
        />
        <Area
          label="Freizeit"
          value={part1.satLeisure}
          color="var(--c-leisure)"
          icon={<SunHorizon size={17} weight="fill" />}
        />
        <Area
          label="Selbst"
          value={part1.satSelf}
          color="var(--c-self)"
          icon={<User size={17} weight="fill" />}
        />
      </div>

      {part1.valueChecks.length > 0 && (
        <Group title="Werte">
          {part1.valueChecks.map((check) => (
            <div key={check.label} className="row row-inset">
              <span className="t-body flex-1">{check.label}</span>
              <span
                className="t-metric text-[15px]"
                style={{ color: "var(--c-values)" }}
              >
                {check.score}/5
              </span>
            </div>
          ))}
        </Group>
      )}

      {part1.prioResults.length > 0 && (
        <Group title="Prios letzte Woche">
          {part1.prioResults.map((prio) => {
            const { label, color, Icon } = RESULT[prio.result];
            return (
              <div key={prio.text} className="row row-inset">
                <span className="icon-plain" style={{ color }}>
                  <Icon size={19} weight="fill" />
                </span>
                <span className="t-body flex-1">{prio.text}</span>
                <span className="t-footnote text-[var(--label-2)]">
                  {label}
                </span>
              </div>
            );
          })}
        </Group>
      )}

      {part1.gapReason && <Prose title="Zur Lücke">{part1.gapReason}</Prose>}

      <Items title="Gelungen" items={part1.wins} color="var(--c-prios)" />
      <Items title="Schwierig" items={part1.challenges} color="var(--c-work)" />
      <Items title="Weniger davon" items={part1.drops} color="var(--c-self)" />

      {part2 && (
        <>
          {part2.identity && (
            <Group title="Identität">
              <div className="row row-inset">
                <span className="t-title3">{part2.identity}</span>
              </div>
            </Group>
          )}
          {part2.prios.length > 0 && (
            <Group title="Prios nächste Woche">
              {part2.prios.map((text, index) => (
                <div key={index} className="row row-inset">
                  <span className="t-metric w-5 text-center text-[15px] text-[var(--c-prios)]">
                    {index + 1}
                  </span>
                  <span className="t-body">{text}</span>
                </div>
              ))}
            </Group>
          )}
          {part2.vision && <Prose title="Vision">{part2.vision}</Prose>}
          {part2.aarBetter && (
            <Prose title="Anders diesmal">{part2.aarBetter}</Prose>
          )}
        </>
      )}

      {noteToMe && (
        <div>
          <p className="t-footnote px-4 pb-1.5 text-[var(--label-2)]">
            {name} an dich
          </p>
          <div className="rounded-xl p-4" style={{ background: "var(--card)" }}>
            <p className="t-body">{noteToMe}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Area({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | null;
  color: string;
  icon: React.ReactNode;
}) {
  if (value === null) return null;
  return (
    <div className="row row-inset">
      <span className="icon-tile" style={{ background: color }}>
        {icon}
      </span>
      <span className="t-body flex-1">{label}</span>
      <span className="t-metric text-[17px]" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="t-footnote px-4 pb-1.5 text-[var(--label-2)]">{title}</p>
      <div className="list">{children}</div>
    </div>
  );
}

function Prose({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="t-footnote px-4 pb-1.5 text-[var(--label-2)]">{title}</p>
      <div className="rounded-xl p-4" style={{ background: "var(--card)" }}>
        <p className="t-body">{children}</p>
      </div>
    </div>
  );
}

function Items({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <Group title={title}>
      {items.map((text, index) => (
        <div key={index} className="row row-inset">
          <span
            aria-hidden
            className="mt-[7px] size-1.5 shrink-0 self-start rounded-full"
            style={{ background: color }}
          />
          <span className="t-body">{text}</span>
        </div>
      ))}
    </Group>
  );
}
