"use client";

import {
  ChartLine,
  Compass,
  House,
  ListDashes,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Eine Liste, zwei Leisten.
 *
 * **Unter 1024 px eine Tab-Leiste unten.** Das ist die Form, die Health auf dem
 * iPhone benutzt, und sie ist dort richtig, weil der Daumen unten ist.
 *
 * **Ab 1024 px eine Seitenleiste.** Eine Tab-Leiste am unteren Rand eines
 * 27-Zoll-Bildschirms legt die Navigation 900 px unter den Inhalt, den sie
 * steuert, und lässt die ganze Breite ungenutzt. Health macht auf dem Mac und
 * auf dem iPad im Querformat genau diesen Wechsel. Die Grenze liegt bei 1024 und
 * nicht bei 768, damit das iPad im Hochformat die Tab-Leiste behält: 768 minus
 * Seitenleiste wäre eine Inhaltsspalte, die schmaler ist als das iPhone.
 *
 * `Wochen` steht zwischen Übersicht und Verlauf: die Seite zeigt einzelne
 * Wochen, gehört also neben die Übersicht und nicht neben die Diagramme. Vier
 * Einträge sind das Maximum, das beide Leisten ohne Änderung tragen — die Tabs
 * liegen auf `flex-1`, und 375 / 4 = 93 px pro Tab. Ein fünfter Bereich müsste
 * unter `Fundament` wandern, nicht in die Leiste.
 */
const ITEMS: Array<{ href: string; label: string; icon: typeof House }> = [
  { href: "/", label: "Übersicht", icon: House },
  // Listen-Glyphe und kein Kalenderblatt: die Seite ist eine Liste von Wochen,
  // und ein Kalendersymbol würde auf den Kalendertermin im Fundament zeigen.
  { href: "/wochen", label: "Wochen", icon: ListDashes },
  { href: "/verlauf", label: "Verlauf", icon: ChartLine },
  { href: "/fundament", label: "Fundament", icon: Compass },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TabBar() {
  const isActive = useActive();

  return (
    <nav
      aria-label="Bereiche"
      className="fixed inset-x-0 bottom-0 z-20 lg:hidden"
      style={{
        // Durchscheinend wie die iOS-Tab-Leiste, damit Inhalt darunter
        // durchschimmert statt abgeschnitten zu wirken.
        background: "color-mix(in srgb, var(--card) 82%, transparent)",
        backdropFilter: "blur(20px)",
        borderTop: "0.5px solid var(--separator)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex">
        {ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-[49px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
              style={{ color: active ? "var(--c-blue)" : "var(--label-2)" }}
            >
              <item.icon size={25} weight={active ? "fill" : "regular"} />
              <span className="text-[10px] leading-[13px] font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SideNav({ name }: { name: string }) {
  const isActive = useActive();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-0.5 px-3 pt-8 lg:flex">
      <p className="t-footnote px-3 pb-3 font-semibold text-[var(--label-2)]">
        Accountability
      </p>

      {ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex min-h-11 items-center gap-3 rounded-[10px] px-3"
            style={{
              background: active ? "var(--fill)" : undefined,
              color: active ? "var(--c-blue)" : "var(--label)",
            }}
          >
            <item.icon
              size={20}
              weight={active ? "fill" : "regular"}
              style={{ color: active ? "var(--c-blue)" : "var(--label-2)" }}
            />
            <span className="t-body">{item.label}</span>
          </Link>
        );
      })}

      <p className="t-footnote mt-auto px-3 pb-6 text-[var(--label-3)]">
        Angemeldet als {name}
      </p>
    </aside>
  );
}
