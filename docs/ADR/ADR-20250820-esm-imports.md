# ADR-20250820 — ESM everywhere + explicit .js imports from TS

## Context
Node projects (`brain-api`, `tech-gateway`) are `"type": "module"`. TS emits `.js`. Node ESM resolver needs explicit file extensions.

## Decision
- Keep ESM across services.
- In TS source, import local files with explicit `.js` when they compile to JS and are imported by other compiled JS (e.g. `import techRouter from "./routes/tech.js"`).
- Avoid `require()` in ESM; use `import` and `express.json()`.

## Consequences
- Fewer “ERR_MODULE_NOT_FOUND” issues.
- Clear boundary between TS dev-time paths and JS runtime paths.

## Alternatives Considered
- CommonJS (`type: "commonjs"`): simpler resolver but conflicts with newer deps and our ESM-first direction.

## References
- Commit: ESM import fixes in `apps/tech-gateway/src/server.ts`