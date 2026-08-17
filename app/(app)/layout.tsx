import { AuthError, requirePerson } from "@/lib/auth.ts";
import { SideNav, TabBar } from "./nav.tsx";

/**
 * Die Hülle. Prüft die Identität einmal für alle Seiten darunter.
 *
 * `AuthError` wird hier zu einer lesbaren Seite und nicht zu einem Stacktrace:
 * der Fall "meine Adresse steht nicht in der Allowlist" ist der wahrscheinliche
 * Erstkontakt-Fehler, und er muss sagen, was zu tun ist.
 *
 * Kein Kopfbereich mit App-Namen: auf dem iPhone steht dort der Large Title der
 * Seite, so wie in Health. Der App-Name gehört auf das Home-Symbol, nicht in
 * jede Ansicht.
 *
 * Die Inhaltsspalte ist ab 1024 px breiter als die 680 px des Telefons, weil
 * die Seiten darunter zwei Kartenspalten nebeneinander legen (`xl:grid-cols-2`).
 * Eine 480-px-Spalte in der Mitte von 1440 px wäre nur ein hochskaliertes
 * Telefon.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let name: string;
  try {
    const { me } = await requirePerson();
    name = me.name;
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6 text-center">
        <h1 className="t-title2">Kein Zugang</h1>
        <p className="t-subhead text-[var(--label-2)]">
          {error.message}. Diese App ist für zwei feste Adressen. Wenn das deine
          sein soll, muss sie in <code>ACC_PEOPLE</code> stehen.
        </p>
      </main>
    );
  }

  return (
    <div className="lg:flex">
      <SideNav name={name} />

      <div className="min-h-dvh flex-1">
        {/* Unten: 49 px Tab-Leiste plus Home-Leiste des iPhones. Ohne das liegt
            die letzte Zeile jeder Liste unter der Navigation. */}
        <main className="mx-auto w-full max-w-[680px] px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:max-w-[900px] lg:px-8 lg:pt-6 lg:pb-16">
          {children}
        </main>
      </div>

      <TabBar />
    </div>
  );
}
