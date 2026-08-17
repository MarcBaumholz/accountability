"use client";

import { useId, useRef } from "react";

/**
 * 295° violett bis 110° gelbgrün, mit einer Kurve statt linear.
 *
 * Linear wäre falsch, weil es die kalten Töne über die ganze obere Hälfte
 * streckt: eine 7 landete bei Türkis, obwohl daneben "gut" steht. Der Exponent
 * verkürzt das kühle Ende, sodass 7 grün ist und die Farbe zu dem passt, was
 * das Wort sagt. Dieselbe Richtung wie im State-of-Mind-Screen von Health:
 * unangenehm ist indigo, angenehm ist gelbgrün.
 */
export function hueFor(score: number): number {
  const t = (score - 1) / 9;
  return 295 - 185 * t ** 0.75;
}

/**
 * Der Score-Regler, nach dem State-of-Mind-Screen aus Apple Health.
 *
 * Die Form ist nicht eine Blase, sondern fünf ineinanderliegende Schichten, die
 * unterschiedlich schnell rotieren. Die Farbe steckt im Elternelement
 * (`.hue-screen`), damit sich der ganze Bildschirm mittönt und nicht nur ein
 * Fleck darin.
 *
 * Ungesetzt bleibt sichtbar ungesetzt: ein farbiger Kern bei 5 würde beim
 * Durchklicken als Antwort gezählt, obwohl niemand den Regler angefasst hat,
 * und verfälscht damit den ganzen Verlauf.
 */
export function ScoreSlider({
  value,
  onChange,
  low,
  high,
  labels,
}: {
  value: number | null;
  onChange: (value: number) => void;
  low: string;
  high: string;
  labels?: readonly string[];
}) {
  const unset = value === null;
  const shown = value ?? 5;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="mood" data-unset={unset} aria-hidden>
        <span className="mood-layer" />
        <span className="mood-layer" />
        <span className="mood-layer" />
        <span className="mood-layer" />
        <span className="mood-layer" />
      </div>

      <p className="min-h-8 text-center">
        {unset ? (
          <span className="hue-ink-2 t-body">Zieh den Regler</span>
        ) : (
          <span className="hue-ink t-title2">
            {labels?.[shown - 1] ?? shown}
          </span>
        )}
      </p>

      <div className="w-full">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={shown}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider"
          aria-label={`${low} bis ${high}`}
          aria-valuetext={unset ? "keine Angabe" : String(shown)}
        />
        <div className="hue-ink-2 mt-2 flex justify-between px-1 text-[11px] font-medium uppercase tracking-[0.06em]">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Ein Bereichs-Score in einer Karte: farbige Icon-Kachel, Name, Zahl, Regler.
 * Das ist die Zeilenform, die Health für Messwerte benutzt.
 */
export function AreaSlider({
  label,
  color,
  icon,
  value,
  onChange,
}: {
  label: string;
  color: string;
  icon: React.ReactNode;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="icon-tile" style={{ background: color }}>
          {icon}
        </span>
        <label htmlFor={id} className="t-body flex-1">
          {label}
        </label>
        <span
          className="t-metric text-[19px]"
          style={{ color: value === null ? "var(--label-3)" : color }}
        >
          {value ?? "-"}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value ?? 5}
        aria-label={label}
        aria-valuetext={value === null ? "keine Angabe" : String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider slider-inline"
        style={{ accentColor: color }}
      />
    </div>
  );
}

/** Werte-Check: fünf Punkte, wie eine Health-Bewertungsskala. */
export function ValueScale({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string | null;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-headline">{label}</span>
        <span
          className="t-metric text-[15px]"
          style={{
            color: value === null ? "var(--label-3)" : "var(--c-values)",
          }}
        >
          {value === null ? "-" : `${value}/5`}
        </span>
      </div>
      {hint && <p className="t-footnote text-[var(--label-2)]">{hint}</p>}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${label}: ${n} von 5`}
              aria-pressed={value === n}
              className="h-9 flex-1 rounded-[9px] transition-colors"
              style={{
                background: on ? "var(--c-values)" : "var(--fill)",
                color: on ? "#fff" : "var(--label-2)",
              }}
            >
              <span className="t-metric text-[13px]">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Freie Liste. Enter fügt eine Zeile hinzu; leere Zeilen fallen beim Speichern
 * weg. Es gibt immer genau eine leere Zeile am Ende, damit nie ein Plus-Knopf
 * gesucht werden muss.
 */
export function ListInput({
  values,
  onChange,
  placeholder,
  max,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  max?: number;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  // Mit Obergrenze: immer genau `max` Zeilen, auch leere. Sonst stünde bei
  // leeren Prios kein einziges Eingabefeld da.
  const rows = max
    ? Array.from({ length: max }, (_, i) => values[i] ?? "")
    : [...values, ""];

  const set = (index: number, text: string) => {
    const next = [...rows];
    next[index] = text;
    onChange(next);
  };

  return (
    <div className="list">
      {rows.map((text, index) => (
        <div key={index} className="row row-inset">
          <span className="t-metric w-4 text-center text-[15px] text-[var(--label-3)]">
            {index + 1}
          </span>
          <input
            ref={(el) => {
              refs.current[index] = el;
            }}
            value={text}
            onChange={(e) => set(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (!max && index === rows.length - 1 && text.trim()) {
                onChange([...rows, ""]);
              }
              requestAnimationFrame(() => refs.current[index + 1]?.focus());
            }}
            placeholder={index === 0 ? placeholder : ""}
            maxLength={200}
            className="t-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--label-3)]"
          />
        </div>
      ))}
    </div>
  );
}

const RESULTS = [
  { value: "done", label: "Erreicht" },
  { value: "partly", label: "Teilweise" },
  { value: "missed", label: "Nicht" },
] as const;

export type PrioResult = (typeof RESULTS)[number]["value"];

/** Prio mit segmentierter Auswahl, wie ein iOS Segmented Control. */
export function PrioChoice({
  text,
  value,
  onChange,
}: {
  text: string;
  value: PrioResult | null;
  onChange: (value: PrioResult) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5">
      <p className="t-headline">{text}</p>
      <div className="segment">
        {RESULTS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 6,
  maxLength = 2000,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      className="field resize-none"
    />
  );
}
