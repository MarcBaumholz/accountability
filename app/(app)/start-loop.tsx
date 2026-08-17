"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { startLoop } from "@/lib/actions.ts";
import type { Mode } from "@/lib/loop.ts";

/**
 * Die Knöpfe auf der Startseite.
 *
 * Die Moduswahl steht hier und nicht im Loop: ein Zwischenschirm "kurz oder
 * lang?" wäre der zweite Klick, und die Anforderung ist genau einer (PRD 01).
 *
 * Auf großen Schirmen bleibt der Knopf schmal. Ein 900 px breiter blauer Balken
 * ist nicht prominenter als ein 320 px breiter, nur größer — iOS lässt eine
 * gefüllte Aktion auf dem Mac ebenfalls nicht über die ganze Fensterbreite
 * laufen.
 */
export function StartLoop({
  week,
  status,
}: {
  week: string;
  status: "none" | "draft" | "part1" | "submitted";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (mode: Mode) =>
    startTransition(async () => {
      await startLoop(mode, week);
      router.push(`/loop/${week}`);
    });

  const open = () => startTransition(() => router.push(`/loop/${week}`));

  if (status === "submitted") {
    return (
      <Stack>
        <button
          type="button"
          disabled={pending}
          onClick={open}
          className="btn btn-tinted w-full"
        >
          Woche ansehen
        </button>
        <Note>Abgegeben. Ändern geht weiterhin.</Note>
      </Stack>
    );
  }

  if (status !== "none") {
    return (
      <Stack>
        <button
          type="button"
          disabled={pending}
          onClick={open}
          className="btn btn-filled w-full"
        >
          {pending ? "…" : "Weitermachen"}
        </button>
        <Note>Deine Antworten sind gespeichert.</Note>
      </Stack>
    );
  }

  return (
    <Stack>
      <button
        type="button"
        disabled={pending}
        onClick={() => go("full")}
        className="btn btn-filled w-full"
      >
        {pending ? "…" : "Woche reviewen"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => go("minimal")}
        className="btn btn-plain w-full"
      >
        Kurzversion, 2 Min
      </button>
    </Stack>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:max-w-[320px]">{children}</div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="t-footnote pt-1 text-center text-[var(--label-2)]">
      {children}
    </p>
  );
}
