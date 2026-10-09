# Offline-first is deferred

The Electron desktop app requires a live connection to the API; there is no local database, write queue, or sync. Full offline-first for financial data (conflict resolution on invoices and stock) is a project in its own right, and the client has not confirmed that the desktop machine ever loses connectivity.

**Consequences:** PRD §8 Q1 is closed as deferred; the PRD no longer counts offline-first as a delivery gap. Revisit only if the client confirms offline operation is required.

**Status:** accepted
