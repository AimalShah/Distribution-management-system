# Feature-folder modularity with route-level code splitting

The web app is organised by **feature** (`features/<domain>/` holding `components/`, `hooks/`, and API calls), not by technical layer. Page files are thin containers under ~150 lines and no source file exceeds ~300 lines; large forms are split into a `useXForm` hook, an `XFormFields` presentational component, and a schema from `packages/shared`. Routes are `React.lazy`-loaded so first paint does not download every page.

**Considered options:** a layered `components / pages / hooks` split was rejected because it scatters each feature across the tree; a single-bundle router was rejected because it ships all ~15.7k lines of `apps/web/src` on first paint.

**Consequences:** new code follows the folder and size conventions; the existing oversized files are migrated to it.

**Status:** accepted
