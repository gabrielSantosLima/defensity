# Architecture

Status: **accepted** · applies from M0 onward.

The reference implementation is [OhMyChannel](https://github.com/gabrielSantosLima/OhMyChannel),
an Electron + React app that separates controllers, use cases, services and
entities inside the main process. We keep its layering discipline and change what
does not scale for an agent that runs long analyses.

## Goals

1. The agent must never freeze the interface.
2. Contracts between processes are typed once, in `shared/`.
3. Persistence must support append-only run events, not just documents.
4. A run is reproducible: provider, model, scope and artifacts are snapshotted.
5. Every capability the agent uses is a port with a single adapter, so it can be
   tested without Docker or a network.

## What we take from OhMyChannel

| Pattern | Why |
| --- | --- |
| Use case per operation, dependencies injected | Testable without Electron |
| Entities at the serialization boundary | One place for defaults and validation |
| Thin preload, `contextIsolation` on | Renderer never touches Node |
| CSP injected per environment by the Vite plugin | Dev needs localhost, production does not |
| Secret cipher behind an interface | Keychain is an implementation detail |

## What we change

| OhMyChannel | defensity | Reason |
| --- | --- | --- |
| `main.js` with 961 lines | `bootstrap` + `window` + `ipc/` | The agent adds too much to keep one file |
| Flat `window.api` with 40 methods | Typed namespaced channels | Contracts and discoverability |
| JSON store per aggregate | SQLite repositories | Runs, events and findings are relational and grow |
| Controller classes | IPC handler as the adapter | Same thinness, less ceremony |
| JavaScript | TypeScript end to end | Contracts across processes |
| Everything in main | Agent in `utilityProcess` | A stuck tool cannot block the UI |
| No tests | Unit tests on use cases and repositories | The domain has rules worth locking |

## Processes

```text
┌───────────────────────────── Electron ─────────────────────────────┐
│                                                                    │
│  main (bootstrap)              utilityProcess (agent)              │
│  ├─ window / menu              ├─ orchestrator                     │
│  ├─ ipc handlers               ├─ provider adapters                │
│  ├─ application (use cases)    ├─ tool registry + executor         │
│  └─ infrastructure             ├─ context manager / compaction     │
│      ├─ sqlite                 └─ telemetry                        │
│      ├─ keychain                                                   │
│      └─ docker / gatling                                           │
│            ▲                          ▲                            │
└────────────┼──────────────────────────┼────────────────────────────┘
             │ ipcMain / ipcRenderer    │ MessagePort or ipc
        ┌────┴──────────────────────────┴────┐
        │  preload  (contextBridge, typed)   │
        └────────────────┬───────────────────┘
                         │
                 renderer (React)
```

- The renderer never imports Node, Electron or the database.
- The agent never touches `BrowserWindow`; it reports through events.
- The agent reaches the outside world only through tools, and tools only through
  ports implemented in `infrastructure/`.
- Main owns the database. The agent receives data through commands and returns
  results through events; it does not open the database file.

## Layers

```text
electron/
  bootstrap.ts          entry point: app lifecycle, composition root
  window.ts             BrowserWindow, CSP, external navigation guard
  ipc/                  adapters: one file per namespace
  application/          use cases (workspace creation, run lifecycle)
  domain/
    entities/           Workspace, Artifact, Run, Hypothesis, Finding
    ports/              interfaces the application depends on
  infrastructure/
    db/                 connection, migrations, repositories
    secrets/            keychain store
    docker/             runtime and Gatling adapters (M3)
    providers/          model provider adapters (M1)
    fs/                 fingerprints and artifact readers
  agent/                utilityProcess entry and modules (M1)
shared/                 types, channel names, API contract
src/                    renderer (React)
```

Dependency rule: `domain` depends on nothing. `application` depends on `domain`.
`infrastructure` implements `domain/ports`. `ipc` and `bootstrap` depend on
application and infrastructure. Never the reverse.

Inside the renderer: `pages` use `components` and `lib`; `components` are
presentational and do not call IPC directly.

## IPC contract

- Channel names are `namespace:action`, lowercase: `workspaces:create`,
  `settings:save`, `runs:start`.
- Every channel has a request and a response type in `shared/`.
- Preload exposes a single namespaced object, not a flat list:
  `workspaces.list()`, `settings.save(patch)`, `runs.subscribe(callback)`.
- Commands return data or throw. The renderer shows the error message; the main
  process logs the detail.
- Long operations return an id immediately and report progress through events:
  `run:event` carries `{ runId, seq, type, payload }`.
- Events are subscribed per run and unsubscribed on unmount. No global bus.
- Channels are registered in one place, with the dependencies passed explicitly.

## Persistence

- SQLite is the only store, including settings.
- Migrations are ordered and versioned with `PRAGMA user_version`; changes are
  additive.
- Repositories are the only code that writes SQL.
- Tables: `workspaces`, `artifacts`, `runs`, `run_events`, `hypotheses`,
  `findings`, `settings`.
- `run_events` is append-only and ordered by `(run_id, seq)`.
- Secrets never enter SQLite. Only a boolean "key present" is derived at read
  time from the keychain.

## Security boundaries

| Boundary | Rule |
| --- | --- |
| Renderer → main | Only declared channels; no `ipcRenderer` exposed |
| Main → keychain | Encrypt with `safeStorage`; fail if unavailable |
| Agent → host | Only through tools; no direct `fs`, `http` or `docker` |
| Agent → target | Scope frozen per run; a tool call outside scope is refused |
| Logs | Redaction by default; secrets never logged |

## Testing

| Layer | Style |
| --- | --- |
| Domain entities | Pure unit tests |
| Application use cases | Unit tests with fake ports |
| Repositories | Integration test against a temporary SQLite file |
| Providers | Contract tests with recorded responses |
| IPC | One smoke test per namespace |

A use case that cannot be tested without Electron is a sign the dependency is in
the wrong layer.

## Evolution

- M1 adds `agent/` as a `utilityProcess`, with the same ports but a separate
  memory space.
- M3 adds Docker and Gatling adapters under `infrastructure/`; the application
  layer only sees `ContainerRuntime` and `Validator`.
- If a second window is ever needed, `window.ts` already isolates creation from
  lifecycle.
