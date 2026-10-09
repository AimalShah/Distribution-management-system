# apps/web is the single canonical web surface

The repository previously carried two parallel web apps: a Next.js app at `src/` and a Vite + React Router SPA at `apps/web`. Features were duplicated and drifted. The Electron shell (`apps/desktop`) loads `apps/web`, so the Vite app is the one that actually ships. We deleted `src/` and made `apps/web` the only web surface.

**Consequences:** any feature work, including everything the PRD places only in `src/`, is built once in `apps/web`. PRD §8 Q11 and §10 defect 4 are resolved.

**Status:** accepted
