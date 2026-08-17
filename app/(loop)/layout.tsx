import { AuthError, requirePerson } from "@/lib/auth.ts";

/**
 * Der Loop ist ein Vollbild-Sheet, nicht eine Seite in der App-Hülle.
 *
 * Eigene Route-Gruppe, damit keine Kopfzeile und keine Navigation darüber
 * liegen: eine Frage pro Bildschirm heißt, dass auf dem Bildschirm auch nur
 * diese Frage ist. Health macht seine Eingabe-Flows genauso als Sheet über der
 * Übersicht.
 */
export default async function LoopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    await requirePerson();
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-6 text-center">
        <h1 className="t-title2">Kein Zugang</h1>
        <p className="t-subhead text-[var(--label-2)]">{error.message}</p>
      </main>
    );
  }

  return <>{children}</>;
}
