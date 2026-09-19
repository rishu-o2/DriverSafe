# DriverSafe

A cinematic landing page for an AI-powered unsupervised drowsiness detection system.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/driversafe/src/App.tsx` — landing page, auth routes, and scroll reveal interactions
- `artifacts/driversafe/src/index.css` — dark cinematic theme, glass pills, grid, marquee, and responsive styles
- `artifacts/driversafe/src/main.tsx` — React entry point

## Architecture decisions

- The first build is frontend-only; Login and Sign Up are local interaction screens until an authentication provider is connected.
- GSAP ScrollTrigger handles the giant DriverSafe reveal and staggered footer content animation.
- The landing page uses a dark-only #080b14 palette with reduced-motion support.

## Product

- Cinematic DriverSafe landing experience
- Scroll-triggered reveal of the product identity
- Working Login and Sign Up entry points with local success states

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
