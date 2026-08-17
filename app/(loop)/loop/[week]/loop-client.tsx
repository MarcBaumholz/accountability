"use client";

import {
  Briefcase,
  CaretLeft,
  SunHorizon,
  User,
  X,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  savePartnerNote,
  savePrioReview,
  savePrios,
  saveList,
  saveScore,
  saveText,
  saveValueCheck,
  submitEntry,
  submitPart1,
} from "@/lib/actions.ts";
import type { Part1View, Part2View } from "@/lib/data.ts";
import {
  LIMITS,
  type Mode,
  type ScreenId,
  lastScreenOfPart1,
  visibleScreens,
} from "@/lib/loop.ts";
import { weekLabel } from "@/lib/week.ts";
import {
  AreaSlider,
  ListInput,
  type PrioResult,
  PrioChoice,
  ScoreSlider,
  TextArea,
  ValueScale,
  hueFor,
} from "./fields.tsx";
import { PartnerCard } from "./partner-card.tsx";
import { useAutosave } from "./use-autosave.ts";

/** Die Wortmarken zum Lifescore. Die Farbe folgt derselben Skala. */
const LIFESCORE_LABELS = [
  "Sehr unzufrieden",
  "Unzufrieden",
  "Eher unzufrieden",
  "Durchwachsen",
  "Geht so",
  "In Ordnung",
  "Gut",
  "Richtig gut",
  "Sehr gut",
  "Hervorragend",
] as const;

/** Die Schirme, auf denen der ganze Bildschirm mittönt. */
const HUE_SCREENS = new Set<ScreenId>(["lifescore"]);

export type LoopProps = {
  week: string;
  mode: Mode;
  status: "draft" | "part1" | "submitted";
  values: Array<{ id: string; label: string; description: string | null }>;
  goals: string[];
  lastWeekPrios: Array<{ id: string; text: string }>;
  /**
   * Der Name des Partners, unabhängig von der Freigabe.
   *
   * Getrennt von `partner`, weil der Name kein geschützter Inhalt ist (er steht
   * schon auf der Startseite), der Hinweis am Freigabe-Knopf aber "Chris sieht
   * danach deinen Rückblick" sagen soll. Über `partner` ginge das nicht: das
   * Objekt ist vor der Freigabe absichtlich null.
   */
  partnerName: string | null;
  partner: {
    name: string;
    part1: Part1View;
    part2: Part2View | null;
    noteToMe: string | null;
  } | null;
  initial: {
    lifescore: number | null;
    satWork: number | null;
    satLeisure: number | null;
    satSelf: number | null;
    gapReason: string;
    identity: string;
    vision: string;
    aarBetter: string;
    wins: string[];
    challenges: string[];
    drops: string[];
    prios: string[];
    prioReviews: Record<string, PrioResult>;
    valueChecks: Record<string, number>;
    note: string;
  };
};

export function LoopClient(props: LoopProps) {
  const router = useRouter();
  const { save, flush, saving, failed } = useAutosave();
  const [answers, setAnswers] = useState(props.initial);
  const [status, setStatus] = useState(props.status);
  const [index, setIndex] = useState(0);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { week, mode } = props;

  // Die Schirmliste wird bei jeder Antwort neu berechnet, nicht einmal am
  // Anfang. Nur so erscheint "Warum die Lücke?" in dem Moment, in dem eine Prio
  // als nicht erreicht markiert wird, und verschwindet wieder, wenn die
  // Markierung zurückgenommen wird.
  const screens = useMemo(
    () =>
      visibleScreens(mode, {
        prioReviews: Object.values(answers.prioReviews).map((result) => ({
          result,
        })),
        hasPartnerPart1: props.partner !== null,
        hasValues: props.values.length > 0,
        hasLastWeekPrios: props.lastWeekPrios.length > 0,
      }),
    [
      mode,
      answers.prioReviews,
      props.partner,
      props.values.length,
      props.lastWeekPrios.length,
    ],
  );

  const clamped = Math.min(index, screens.length - 1);
  const screen = screens[clamped];
  const gateAfter = lastScreenOfPart1(screens);
  const isPart1Gate = screen?.id === gateAfter && status === "draft";
  const isLast = clamped === screens.length - 1;

  const patch = <K extends keyof typeof answers>(
    key: K,
    value: (typeof answers)[K],
  ) => setAnswers((prev) => ({ ...prev, [key]: value }));

  /**
   * Wie `patch`, aber der neue Wert wird aus dem *aktuellen* State berechnet.
   *
   * Nötig für die beiden Felder, die zusammengeführt statt ersetzt werden
   * (`prioReviews`, `valueChecks`). Mit `patch` würde
   * `{...answers.prioReviews, [id]: result}` aus der Closure lesen, und wer drei
   * Prios schnell hintereinander antippt, erzeugt drei Updates im selben
   * Render-Tick, die alle vom gleichen alten Objekt ausgehen. Nur der letzte
   * Klick überlebt, die anderen zwei verschwinden lautlos.
   *
   * Genau so ist es beim Durchtesten passiert: drei Klicks, ein sichtbarer
   * Wert. Auf dem Handy tippt man eine Dreierliste in genau diesem Tempo ab.
   */
  const patchIn = <K extends "prioReviews" | "valueChecks">(
    key: K,
    update: (prev: (typeof answers)[K]) => (typeof answers)[K],
  ) => setAnswers((prev) => ({ ...prev, [key]: update(prev[key]) }));

  const back = () => {
    void flush();
    setIndex((i) => Math.max(0, i - 1));
  };

  const forward = () =>
    startTransition(async () => {
      setError(null);
      // Erst die offenen Schreibvorgänge, dann weiter. Sonst wäre die letzte
      // Eingabe jedes Schirms die unzuverlässigste.
      await flush();

      if (isPart1Gate) {
        await submitPart1(week);
        setStatus("part1");
        // Der Partner-Schirm kann jetzt Inhalt haben, den der Server noch nicht
        // geliefert hat. Neu laden, damit die Freigabe greift.
        router.refresh();
      }

      if (isLast) {
        try {
          await submitEntry(week);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Abgeben hat nicht funktioniert",
          );
          return;
        }
        router.push("/");
        return;
      }

      setIndex((i) => Math.min(screens.length - 1, i + 1));
    });

  if (!screen) return null;

  const tinted = HUE_SCREENS.has(screen.id);
  const hueUnset = tinted && answers.lifescore === null;
  const hue = hueFor(answers.lifescore ?? 5);

  return (
    <div
      className={tinted ? "hue-screen" : ""}
      data-unset={tinted ? hueUnset : undefined}
      style={tinted ? ({ "--hue": hue } as React.CSSProperties) : undefined}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Kopf im Health-Sheet-Stil: runde Knöpfe links und rechts, Titel
            mittig, darunter der Fortschritt. */}
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={back}
              disabled={clamped === 0 || busy}
              aria-label="Zurück"
              className="btn-circle disabled:opacity-0"
            >
              <CaretLeft size={17} weight="bold" />
            </button>

            <div className="flex flex-col items-center">
              <span
                className={`t-footnote font-semibold ${tinted ? "hue-ink" : ""}`}
              >
                {weekLabel(week)}
              </span>
              <span
                className={`t-caption ${tinted ? "hue-ink-2" : "text-[var(--label-2)]"}`}
                aria-live="polite"
              >
                {failed
                  ? "nicht gespeichert"
                  : saving
                    ? "speichert"
                    : `${clamped + 1} von ${screens.length}`}
              </span>
            </div>

            <Link href="/" aria-label="Schließen" className="btn-circle">
              <X size={15} weight="bold" />
            </Link>
          </div>

          <div className="progress">
            <span
              style={{ width: `${((clamped + 1) / screens.length) * 100}%` }}
            />
          </div>
        </header>

        <div
          key={screen.id}
          className="screen-in flex flex-1 flex-col gap-6 pt-8"
        >
          <div className="px-1">
            <h1 className={`t-large-title ${tinted ? "hue-ink" : ""}`}>
              {screen.question}
            </h1>
            {screen.hint && (
              <p
                className={`t-subhead mt-2 ${tinted ? "hue-ink-2" : "text-[var(--label-2)]"}`}
              >
                {screen.hint}
              </p>
            )}
          </div>

          <div className="flex flex-1 flex-col">
            <Body
              id={screen.id}
              props={props}
              answers={answers}
              patch={patch}
              patchIn={patchIn}
              save={save}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="t-footnote px-1 pb-2 text-[var(--c-red)]">
            {error}
          </p>
        )}

        <footer className="flex flex-col gap-2 pt-4">
          <button
            type="button"
            onClick={forward}
            disabled={busy}
            className="btn btn-filled w-full"
            style={
              tinted && !hueUnset
                ? { background: `oklch(42% 0.11 ${hue})` }
                : undefined
            }
          >
            {busy
              ? "…"
              : isLast
                ? "Abgeben"
                : isPart1Gate
                  ? "Rückblick abgeben"
                  : "Weiter"}
          </button>

          {isPart1Gate && (
            <p className="t-caption px-4 text-center text-[var(--label-2)]">
              {props.partnerName ?? "Dein Partner"} sieht danach deinen
              Rückblick. Das lässt sich nicht zurücknehmen.
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

type Answers = LoopProps["initial"];

function Body({
  id,
  props,
  answers,
  patch,
  patchIn,
  save,
}: {
  id: ScreenId;
  props: LoopProps;
  answers: Answers;
  patch: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
  patchIn: <K extends "prioReviews" | "valueChecks">(
    key: K,
    update: (prev: Answers[K]) => Answers[K],
  ) => void;
  save: (key: string, run: () => Promise<void>, delay?: number) => void;
}) {
  const { week } = props;

  switch (id) {
    case "recap":
      return (
        <div className="list">
          {props.lastWeekPrios.map((prio, i) => (
            <div key={prio.id} className="row row-inset">
              <span className="t-metric w-5 text-center text-[15px] text-[var(--c-prios)]">
                {i + 1}
              </span>
              <span className="t-body">{prio.text}</span>
            </div>
          ))}
        </div>
      );

    case "lifescore":
      return (
        <ScoreSlider
          value={answers.lifescore}
          low="Sehr unzufrieden"
          high="Sehr zufrieden"
          labels={LIFESCORE_LABELS}
          onChange={(v) => {
            patch("lifescore", v);
            save("lifescore", () => saveScore(week, "lifescore", v));
          }}
        />
      );

    case "areas": {
      const areas = [
        {
          field: "satWork",
          label: "Arbeit",
          color: "var(--c-work)",
          icon: <Briefcase size={17} weight="fill" />,
        },
        {
          field: "satLeisure",
          label: "Freizeit",
          color: "var(--c-leisure)",
          icon: <SunHorizon size={17} weight="fill" />,
        },
        {
          field: "satSelf",
          label: "Selbst",
          color: "var(--c-self)",
          icon: <User size={17} weight="fill" />,
        },
      ] as const;

      return (
        <div className="list">
          {areas.map((area) => (
            <AreaSlider
              key={area.field}
              label={area.label}
              color={area.color}
              icon={area.icon}
              value={answers[area.field]}
              onChange={(v) => {
                patch(area.field, v);
                save(area.field, () => saveScore(week, area.field, v));
              }}
            />
          ))}
        </div>
      );
    }

    case "values":
      return (
        <div className="list">
          {props.values.map((value) => (
            <ValueScale
              key={value.id}
              label={value.label}
              hint={value.description}
              value={answers.valueChecks[value.id] ?? null}
              onChange={(score) => {
                patchIn("valueChecks", (prev) => ({
                  ...prev,
                  [value.id]: score,
                }));
                save(`value:${value.id}`, () =>
                  saveValueCheck(week, value.id, score),
                );
              }}
            />
          ))}
        </div>
      );

    case "prioReview":
      return (
        <div className="list">
          {props.lastWeekPrios.map((prio) => (
            <PrioChoice
              key={prio.id}
              text={prio.text}
              value={answers.prioReviews[prio.id] ?? null}
              onChange={(result) => {
                patchIn("prioReviews", (prev) => ({
                  ...prev,
                  [prio.id]: result,
                }));
                save(
                  `prio:${prio.id}`,
                  () => savePrioReview(week, prio.id, result),
                  0,
                );
              }}
            />
          ))}
        </div>
      );

    case "gapReason":
      return (
        <TextArea
          value={answers.gapReason}
          placeholder="Was kam dazwischen?"
          onChange={(v) => {
            patch("gapReason", v);
            save("gapReason", () => saveText(week, "gapReason", v));
          }}
        />
      );

    case "wins":
    case "challenges":
    case "drop": {
      const field = (
        { wins: "wins", challenges: "challenges", drop: "drops" } as const
      )[id];
      const kind = (
        { wins: "win", challenges: "challenge", drop: "drop" } as const
      )[id];
      const placeholder = {
        wins: "Projekt abgeschlossen",
        challenges: "Zu wenig Bewegung",
        drop: "Arbeitsgedanken am Wochenende",
      }[id];

      return (
        <ListInput
          values={answers[field]}
          placeholder={placeholder}
          onChange={(list) => {
            patch(field, list);
            save(kind, () => saveList(week, kind, list));
          }}
        />
      );
    }

    case "identity":
      return (
        <div className="flex flex-col gap-2">
          <input
            value={answers.identity}
            maxLength={LIMITS.identityChars}
            placeholder="Der Fokussierte"
            aria-label="Wort der Woche"
            className="field t-title3"
            onChange={(e) => {
              const v = e.target.value;
              patch("identity", v);
              save("identity", () => saveText(week, "identity", v));
            }}
          />
          <p className="t-caption px-4 text-[var(--label-2)]">
            {LIMITS.identityChars - answers.identity.length} Zeichen übrig
          </p>
        </div>
      );

    case "vision":
      return (
        <TextArea
          value={answers.vision}
          placeholder="Woran merkst du am Sonntag, dass die Woche gut war?"
          onChange={(v) => {
            patch("vision", v);
            save("vision", () => saveText(week, "vision", v));
          }}
        />
      );

    case "prios":
      return (
        <div className="flex flex-col gap-5">
          <ListInput
            values={answers.prios}
            max={LIMITS.prios}
            placeholder="Die eine Sache, die zählt"
            onChange={(list) => {
              patch("prios", list);
              save("prios", () => savePrios(week, list));
            }}
          />
          <p className="t-footnote px-4 text-[var(--label-2)]">
            Höchstens drei. Genau diese bewertest du nächste Woche.
          </p>

          {props.goals.length > 0 && (
            <div>
              <p className="t-footnote px-4 pb-1.5 text-[var(--label-2)]">
                Dieses Jahr wolltest du
              </p>
              <div className="list">
                {props.goals.map((goal) => (
                  <div key={goal} className="row row-inset">
                    <span className="t-subhead text-[var(--label-2)]">
                      {goal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case "aarBetter":
      return (
        <TextArea
          value={answers.aarBetter}
          placeholder="Eine Sache, konkret."
          rows={4}
          onChange={(v) => {
            patch("aarBetter", v);
            save("aarBetter", () => saveText(week, "aarBetter", v));
          }}
        />
      );

    case "partner": {
      if (!props.partner) return null;
      return (
        <div className="flex flex-col gap-6">
          <PartnerCard
            name={props.partner.name}
            part1={props.partner.part1}
            part2={props.partner.part2 ?? undefined}
            noteToMe={props.partner.noteToMe}
          />

          <div className="flex flex-col gap-2">
            <p className="t-footnote px-4 text-[var(--label-2)]">
              Deine Rückmeldung
            </p>
            {/* Der Satzanfang ist nicht Deko: er verschiebt die Aussage von
                "du solltest" zu "ich hätte", der Unterschied zwischen einem
                Rat, der ankommt, und einem, der abprallt. */}
            <textarea
              value={answers.note}
              rows={4}
              maxLength={LIMITS.textChars}
              placeholder="Wenn das meine Woche gewesen wäre, hätte ich"
              className="field resize-none"
              aria-label="Deine Rückmeldung an den Partner"
              onChange={(e) => {
                const v = e.target.value;
                patch("note", v);
                save("note", () => savePartnerNote(week, v));
              }}
            />
            <p className="t-caption px-4 text-[var(--label-2)]">
              {props.partner.name} sieht das, wenn ihr beide abgegeben habt.
            </p>
          </div>
        </div>
      );
    }
  }
}
