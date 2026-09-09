# Car Shop POS Architecture

The repository is organized as a small monorepo with independently runnable
applications. Each package owns one runtime responsibility and communicates
with the others through explicit interfaces.

## Runtime boundaries

```text
frontend  ->  backend API  ->  database
    |
    +------> print-agent -> thermal printer

electron-app packages the frontend for Windows desktop use.
```

## Package ownership

- `backend/`: centralized HTTP API, authentication, business routes, services,
  database schema, migrations, and server-side scripts.
- `frontend/`: React/Vite cashier and administration interface. It depends on
  the backend API and the local print agent, but contains no database access.
- `print-agent/`: branch-local printer bridge. It accepts print payloads from
  the frontend and talks to the Windows thermal printer.
- `electron-app/`: desktop shell and installer configuration. It packages the
  built frontend and does not duplicate backend or printer business logic.
- `docs/`: architecture and operational documentation that applies across
  packages.

## Change guidelines

1. Keep business rules in `backend/services` or the owning backend route.
2. Keep browser state and presentation in `frontend/src`.
3. Keep printer and Windows-specific behavior in `print-agent` or
   `electron-app`.
4. Treat `dist/`, installers, ZIP exports, `node_modules/`, screenshots, and
   environment files as local or generated artifacts rather than source.
5. Update the package README or deployment documentation when a package's
   runtime contract changes.