# Accountability auf dem Raspberry Pi 5 (linux/arm64).
#
# Gebaut wird ON dem Pi, durch `docker compose up -d --build`. Das ist keine
# Bequemlichkeit: `better-sqlite3` ist ein natives Modul und muss für die
# Zielarchitektur und die libc des Ziels kompiliert werden. Ein auf dem Mac
# gebautes Image (oder mitkopierte node_modules) ergibt einen Container, der
# startet und beim ersten Datenbankzugriff stirbt.
#
# Drei Stufen, damit im Laufzeit-Image weder Compiler noch devDependencies
# liegen: deps -> builder -> runner.
#
# node:25-bookworm-slim, nicht node:22 wie LifeOS. Der Grund ist nicht Vorliebe:
# das Image bringt Node v25.9.0 und npm 11.12.1 mit — genau die Versionen des
# Macs, auf dem package-lock.json geschrieben wird. node:22 liefert npm 10.9.8,
# und npm 10 löst die OPTIONALE Peer-Abhängigkeit `esbuild` von Vite anders auf
# als npm 11: es verlangt esbuilds 26 Plattformpakete als Pflicht und bricht
# dann mit EBADPLATFORM ab ("Unsupported platform for @esbuild/aix-ppc64").
# Beide Deploy-Versuche vom 2026-08-17 sind daran gestorben. Wer den Lockfile
# mit npm 11 schreibt, muss ihn mit npm 11 installieren.

FROM node:25-bookworm-slim AS deps
WORKDIR /app
# python3/make/g++ braucht node-gyp, um better-sqlite3 aus dem Quellcode zu
# bauen. Für arm64 gibt es kein passendes Prebuild, das hier greift.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# `npm ci` und nicht `npm install`: exakt der Lockfile-Baum, inklusive
# @esbuild/linux-arm64, das der Service-Worker-Build braucht. devDependencies
# bleiben drin, denn `next build` braucht typescript, tailwind und serwist.
RUN npm ci

FROM node:25-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PHASE setzt Next selbst auf "phase-production-build"; db/migrate.ts
# erkennt das und migriert im Build NICHT. Im Build-Container gibt es kein
# Datenvolume, und mehrere Build-Worker liefen sonst ins Rennen.
RUN npm run build

FROM node:25-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8100 \
    HOSTNAME=0.0.0.0

# `.next/static` und `public/` sind NICHT Teil der Standalone-Ausgabe und
# müssen einzeln kopiert werden. Das ist der häufigste Fehler beim
# Selbst-Hosten von Next: der Server läuft, aber jede Seite kommt ohne CSS und
# ohne JavaScript.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Die Migrationen reisen mit: db/migrate.ts liest sie zur Laufzeit aus
# `process.cwd()/db/migrations`, wenn die Datenbank geöffnet wird. Kein
# separater Migrationsschritt — der könnte im Standalone-Image ohnehin nicht
# laufen, weil dort nur die getracten Pakete liegen und `drizzle-orm` in die
# Server-Chunks hineinkompiliert ist (ERR_MODULE_NOT_FOUND).
COPY --from=builder /app/db ./db

# Der Ordner ist im Container nur der Mount-Punkt; die echten Daten liegen auf
# dem Bind-Mount des Hosts. Ihn hier anzulegen und `node` zu übergeben, macht
# den Start auch dann noch sauber, wenn jemand ohne Volume startet.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 8100

# Der Health-Check fasst über /healthz die Datenbank an. Ein Prozess, der
# läuft, aber seine eigenen Daten nicht lesen kann, ist nicht gesund — genau so
# übersteht ein falsch gemountetes Volume sonst einen Deploy unbemerkt.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8100/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
