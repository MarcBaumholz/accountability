import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Derselbe `@/…`-Alias wie in `tsconfig.json`.
  //
  // Ohne ihn löst Vitest `@/db/index.ts` nicht auf. Das fiel bisher nicht auf,
  // weil die vorhandenen Tests entweder relativ importieren oder das Modul
  // mocken — der erste Test, der ein `@/…`-Modul echt lädt, wäre daran
  // gescheitert, und die Fehlermeldung hätte nach einem Fehler im Test
  // ausgesehen statt nach einer fehlenden Konfiguration.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "db/**/*.test.ts"],
  },
});
