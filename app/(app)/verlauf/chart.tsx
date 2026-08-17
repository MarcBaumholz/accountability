/**
 * Die Diagramme des Verlaufs, als Inline-SVG von Hand.
 *
 * Kein Diagramm-Paket: die Aufgabe ist "bis zu vier Linien über bis zu 52
 * Punkte, feste Skala 1–10". Recharts kostet dafür ~90 KB im Bundle und bringt
 * Achsen-Autoskalierung, Zoom und Tooltips mit, von denen hier nichts gebraucht
 * wird. Das hier rendert auf dem Server und lädt kein Byte JavaScript nach.
 *
 * Vier Entscheidungen, die den Health-Look tragen:
 *
 * 1. **Lücken sind echt.** Eine Woche ohne Antwort ist `null` und unterbricht
 *    die Linie. Eine durchgezogene Linie über eine nicht gefüllte Woche wäre
 *    eine erfundene Zahl.
 * 2. **Ein einzelner Punkt wird gezeichnet.** Wer nach einer Pause eine Woche
 *    füllt, hat einen Punkt ohne Nachbarn — der muss sichtbar sein und nicht
 *    stillschweigend verschwinden.
 * 3. **`vector-effect: non-scaling-stroke`.** Das SVG skaliert von 343 px auf
 *    dem iPhone bis ~840 px auf dem Desktop. Ohne das wäre die Linie auf dem
 *    Desktop 5 px dick. So bleibt sie überall 2,5 px.
 * 4. **Zahlen und Achsenbeschriftung stehen als HTML daneben, nicht im SVG.**
 *    Text im skalierten viewBox wäre auf dem iPhone 6 px hoch und auf dem
 *    Desktop 20 px. Im SVG steht nur Geometrie.
 */
export type Series = {
  label: string;
  color: string;
  points: Array<number | null>;
};

const W = 340;
const H = 116;
const PAD = { top: 10, right: 4, bottom: 4, left: 4 };

export function TrendChart({
  series,
  weeks,
  min,
  max,
  unit,
}: {
  series: Series[];
  weeks: string[];
  min: number;
  max: number;
  /** Steht hinter dem aktuellen Wert, z. B. `/10`. */
  unit: string;
}) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    weeks.length > 1
      ? PAD.left + (i * innerW) / (weeks.length - 1)
      : PAD.left + innerW / 2;
  const y = (value: number) =>
    PAD.top + innerH - ((value - min) / (max - min)) * innerH;

  /**
   * Die Fläche unter der Linie bekommt nur die erste Reihe, und nur solange es
   * höchstens zwei gibt.
   *
   * Bei einer oder zwei Linien ist die erste das Thema (mein Lifescore, der des
   * Partners daneben) — die Fläche sagt "das hier ist die Hauptlinie". Bei drei
   * gleichrangigen Linien ist das Diagramm ein Vergleich, und eine Fläche würde
   * eine davon willkürlich hervorheben; drei Flächen übereinander wären
   * ohnehin nicht lesbar. Health hält es genauso.
   */
  const filled = series.length <= 2;
  const gradient = `fill-${slug(series.map((s) => s.label).join("-"))}`;

  return (
    <figure>
      <Latest series={series} unit={unit} />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={series
          .map(
            (s) =>
              `${s.label}: ${s.points.filter((p) => p !== null).join(", ")}`,
          )
          .join(". ")}
      >
        {filled && (
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                style={{ stopColor: series[0].color, stopOpacity: 0.3 }}
              />
              <stop
                offset="1"
                style={{ stopColor: series[0].color, stopOpacity: 0 }}
              />
            </linearGradient>
          </defs>
        )}

        {/* Zwei Hilfslinien: unten die Skalenuntergrenze, oben gestrichelt die
            Obergrenze. Ein volles Raster wäre bei drei Linien mehr Strich als
            Information. */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(min)}
          y2={y(min)}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          style={{ stroke: "var(--separator)" }}
        />
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(max)}
          y2={y(max)}
          strokeWidth={1}
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
          style={{ stroke: "var(--separator)" }}
        />

        {series.map((s, index) => {
          const parts = segments(s.points);
          return (
            <g key={s.label}>
              {filled &&
                index === 0 &&
                parts
                  .filter((part) => part.length > 1)
                  .map((part, index) => (
                    <path
                      key={`area-${index}`}
                      d={`${line(part, x, y)} L ${x(part[part.length - 1].i)} ${y(min)} L ${x(part[0].i)} ${y(min)} Z`}
                      style={{ fill: `url(#${gradient})` }}
                    />
                  ))}

              {parts
                .filter((part) => part.length > 1)
                .map((part, index) => (
                  <path
                    key={`line-${index}`}
                    d={line(part, x, y)}
                    fill="none"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ stroke: s.color }}
                  />
                ))}

              {/* Einzelpunkte und der jeweils letzte Wert. Als Nulllängen-Pfad
                  mit runder Kappe, damit der Punkt wie die Linie nicht
                  mitskaliert. */}
              {dots(parts).map((point) => (
                <path
                  key={`dot-${point.i}`}
                  d={`M ${x(point.i)} ${y(point.value)} l 0 0`}
                  strokeWidth={7}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ stroke: s.color }}
                />
              ))}
            </g>
          );
        })}
      </svg>

      <figcaption className="flex justify-between px-0.5 pt-1.5">
        <span className="t-caption text-[var(--label-3)]">
          {shortLabel(weeks[0])}
        </span>
        <span className="t-caption text-[var(--label-3)]">
          {shortLabel(weeks[weeks.length - 1])}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Der aktuelle Wert je Linie, über dem Diagramm.
 *
 * Das ersetzt die Y-Achse: eine Kurve ohne Zahl daneben ist eine Form, und die
 * Frage ist "wie stehe ich gerade". Health stellt deshalb in der Übersicht
 * immer erst den Wert und dann die Kurve.
 */
function Latest({ series, unit }: { series: Series[]; unit: string }) {
  // Wo kein Wert ist, steht kein Platzhalter. Ein Strich müsste erklärt werden,
  // und der Name ohne Zahl sagt schon "dazu gibt es hier nichts".
  if (series.length === 1) {
    const value = lastValue(series[0]);
    if (value === null) return null;
    return (
      <p className="flex items-baseline gap-1">
        <span
          className="t-metric text-[34px] leading-[36px]"
          style={{ color: series[0].color }}
        >
          {value}
        </span>
        <span className="t-subhead text-[var(--label-2)]">{unit}</span>
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1">
      {series.map((s) => {
        const value = lastValue(s);
        return (
          <li key={s.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ background: s.color }}
            />
            <span className="t-footnote text-[var(--label-2)]">{s.label}</span>
            {value !== null && (
              <span className="t-metric text-[13px]" style={{ color: s.color }}>
                {value}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Die Trefferquote als gestapelter Balken mit runden Enden.
 *
 * Der einzige Wert im Verlauf, der eine Verhaltensänderung auslösen soll: wer
 * über Monate bei 40 % liegt, nimmt sich zu viel vor (PRD 04). Deshalb steht die
 * Rohzahl über dem Balken und nicht nur der Prozentwert — "11 von 24" ist
 * nachzählbar, "46 %" ist es nicht.
 */
export function RateBar({
  done,
  partly,
  missed,
  total,
}: {
  done: number;
  partly: number;
  missed: number;
  total: number;
}) {
  const parts = [
    { key: "done", count: done, color: "var(--c-prios)" },
    { key: "partly", count: partly, color: "var(--c-work)" },
    { key: "missed", count: missed, color: "var(--fill-2)" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-baseline gap-1.5">
        <span
          className="t-metric text-[34px] leading-[36px]"
          style={{ color: "var(--c-prios)" }}
        >
          {done}
        </span>
        <span className="t-subhead text-[var(--label-2)]">
          von {total} erreicht
        </span>
      </p>

      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {parts
          .filter((part) => part.count > 0)
          .map((part) => (
            <span
              key={part.key}
              style={{
                width: `${(part.count / total) * 100}%`,
                background: part.color,
              }}
            />
          ))}
      </div>

      <p className="t-footnote text-[var(--label-2)]">
        {partly} teilweise, {missed} nicht erreicht
      </p>
    </div>
  );
}

/** Zusammenhängende Abschnitte ohne Lücken. Einzelpunkte bleiben erhalten. */
function segments(points: Array<number | null>) {
  const result: Array<Array<{ i: number; value: number }>> = [];
  let current: Array<{ i: number; value: number }> = [];

  for (const [i, value] of points.entries()) {
    if (value === null) {
      if (current.length > 0) result.push(current);
      current = [];
    } else {
      current.push({ i, value });
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

/**
 * Die Punkte, die gezeichnet werden: jeder Abschnitt ohne Nachbarn und das Ende
 * des letzten Abschnitts. Ein Punkt pro Woche wäre bei 26 Wochen eine
 * Perlenkette.
 */
function dots(parts: Array<Array<{ i: number; value: number }>>) {
  const single = parts.filter((part) => part.length === 1).map((p) => p[0]);
  const last = parts.at(-1);
  if (!last || last.length === 1) return single;
  return [...single, last[last.length - 1]];
}

function line(
  part: Array<{ i: number; value: number }>,
  x: (i: number) => number,
  y: (value: number) => number,
): string {
  return part
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.i)} ${y(point.value)}`)
    .join(" ");
}

function lastValue(series: Series): number | null {
  for (let i = series.points.length - 1; i >= 0; i -= 1) {
    const value = series.points[i];
    if (value !== null) return value;
  }
  return null;
}

function shortLabel(week: string): string {
  return `KW ${Number(week.slice(6))}`;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
