export const metadata = { title: "Offline — Accountability" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-xl font-semibold tracking-tight">Gerade offline</h1>
      <p className="mt-2 text-[var(--muted)] text-sm leading-relaxed">
        Diese Seite war noch nicht geladen, deshalb ist sie offline nicht da.
        Seiten, die du schon offen hattest, funktionieren weiter.
      </p>
      <p className="mt-4 text-[var(--muted)] text-sm leading-relaxed">
        Den Loop zu füllen braucht Verbindung — jede Antwort wird sofort
        gespeichert, und offline gibt es dafür keinen Speicher, der zwei Geräte
        wieder zusammenbringt.
      </p>
    </main>
  );
}
