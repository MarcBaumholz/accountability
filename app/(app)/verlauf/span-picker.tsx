"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const SPANS = [
  { key: "8", label: "8 Wochen" },
  { key: "26", label: "26 Wochen" },
  { key: "all", label: "Alles" },
] as const;

/**
 * Die Zeitfenster als iOS Segmented Control (PRD 04).
 *
 * Knöpfe und nicht Links, weil `.segment > button` die Form aus `globals.css`
 * ist und ein `<a>` darin nicht getroffen wird. Der Zustand bleibt in der URL,
 * damit ein Neuladen dasselbe Fenster zeigt.
 */
export function SpanPicker({ value }: { value: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="segment lg:max-w-[360px]" role="group" aria-label="Zeitraum">
      {SPANS.map((span) => (
        <button
          key={span.key}
          type="button"
          disabled={pending}
          aria-pressed={value === span.key}
          onClick={() =>
            startTransition(() => router.push(`/verlauf?span=${span.key}`))
          }
        >
          {span.label}
        </button>
      ))}
    </div>
  );
}
