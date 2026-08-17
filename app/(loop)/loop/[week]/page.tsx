import { notFound, redirect } from "next/navigation";

import { requirePerson } from "@/lib/auth.ts";
import { loadEntry, loadLoop } from "@/lib/data.ts";
import type { PrioResult } from "./fields.tsx";
import { LoopClient } from "./loop-client.tsx";

export const dynamic = "force-dynamic";

export default async function LoopPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  if (!/^\d{4}-W\d{2}$/.test(week)) notFound();

  const { me, partner } = await requirePerson();
  const entry = await loadEntry(me.id, week);
  // Kein Eintrag heißt: der Loop wurde nicht über die Startseite begonnen. Dort
  // fällt die Moduswahl, also dorthin zurück statt hier still ein "full"
  // anzulegen.
  if (!entry) redirect("/");

  const loop = await loadLoop(me, partner, week, entry);

  return (
    <LoopClient
      week={week}
      mode={entry.mode}
      status={entry.status}
      values={loop.values.map((v) => ({
        id: v.id,
        label: v.label,
        description: v.description,
      }))}
      goals={loop.goals.map((g) => g.label)}
      lastWeekPrios={loop.lastWeekPrios.map((p) => ({
        id: p.id,
        text: p.text,
      }))}
      partnerName={partner?.name ?? null}
      partner={
        loop.partner && loop.partner.visibility !== "status"
          ? {
              name: loop.partner.name,
              part1: loop.partner.part1,
              part2:
                loop.partner.visibility === "all" ? loop.partner.part2 : null,
              noteToMe:
                loop.partner.visibility === "all"
                  ? loop.partner.noteToMe
                  : null,
            }
          : null
      }
      initial={{
        lifescore: entry.lifescore,
        satWork: entry.satWork,
        satLeisure: entry.satLeisure,
        satSelf: entry.satSelf,
        gapReason: entry.gapReason ?? "",
        identity: entry.identity ?? "",
        vision: entry.vision ?? "",
        aarBetter: entry.aarBetter ?? "",
        wins: entry.wins.map((i) => i.text),
        challenges: entry.challenges.map((i) => i.text),
        drops: entry.drops.map((i) => i.text),
        prios: entry.prios.map((i) => i.text),
        prioReviews: Object.fromEntries(
          entry.prioReviews.map((r) => [r.prioId, r.result as PrioResult]),
        ),
        valueChecks: Object.fromEntries(
          entry.valueChecks.map((c) => [c.valueId, c.score]),
        ),
        note: loop.myNote ?? "",
      }}
    />
  );
}
