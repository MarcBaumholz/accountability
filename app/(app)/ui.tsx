import type { ReactNode } from "react";

/**
 * Die drei Bausteine, aus denen jede Seite der App-Hülle besteht.
 *
 * Sie stehen hier und nicht dreimal in den Seiten, weil eine Grouped Inset List
 * nur dann wie iOS wirkt, wenn Titelabstand, Kachelgröße und Zeilenhöhe auf
 * allen Seiten identisch sind. Zwei Kopien davon driften bei der ersten
 * Änderung auseinander.
 *
 * Bewusst keine Komponente für die Karte selbst: das ist `.list` aus
 * `globals.css`, und eine Hülle darum würde nur verstecken, welche Klasse
 * eigentlich wirkt.
 */

/** Titel über einer Kartengruppe, wie in der Health-Übersicht. */
export function Group({
  title,
  action,
  note,
  children,
  className,
}: {
  title?: string;
  /** Rechts neben dem Titel, z. B. ein Link auf eine Detailseite. */
  action?: ReactNode;
  /** Erklärung unter der Karte. Health setzt Hinweise nie darüber. */
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="flex items-baseline justify-between gap-3">
          {title && <h2 className="group-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
      {note && (
        <p className="t-footnote px-4 pt-2 text-[var(--label-2)]">{note}</p>
      )}
    </section>
  );
}

/** Die farbige 29-px-Kachel links in der Zeile. */
export function Tile({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <span className="icon-tile" style={{ background: color }} aria-hidden>
      {children}
    </span>
  );
}

/**
 * Eine Zeile, die nichts anbietet: ein leerer Zustand oder ein Hinweis.
 *
 * Steht in der Karte und nicht darüber, damit eine leere Gruppe dieselbe Form
 * hat wie eine gefüllte. Eine Seite, deren Gerüst sich beim ersten Datensatz
 * verschiebt, wirkt in Woche 1 unfertig — und Woche 1 ist der Normalfall der
 * ersten zwei Monate.
 */
export function HintRow({ children }: { children: ReactNode }) {
  return (
    <div className="row row-inset">
      <p className="t-subhead text-[var(--label-2)]">{children}</p>
    </div>
  );
}
