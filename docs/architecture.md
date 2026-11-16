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
5. Every external capability is a service behind a small interface, so use cases
   can be tested without Docker, a network or a keychain.

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
| JSON store per aggregate | SQLite services | Runs, events and findings are relational and grow |
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
│  ├─ use cases                  ├─ tool registry + executor         │
│  └─ services                   ├─ context manager / compaction     │
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
- The agent reaches the outside world only through its toolset.
- Main owns the database. The agent receives data through commands and returns
  results through events; it does not open the database file.

## Layers

```text
electron/
  bootstrap.ts          entry: lifecycle and composition root
  window.ts             BrowserWindow, CSP, navigation guard
  ipc/                  adapters: one file per namespace
  entities/             Workspace, Artifact, Run, settings rules
  services/             communication with the outside world
    db/                 connection and migrations
    workspaceService.ts SQLite
    settingsService.ts  SQLite
    runService.ts       SQLite
    hypothesisService.ts SQLite hypotheses
    secretService.ts    OS keychain
    fileService.ts      fingerprints
    providerService.ts  provider HTTP APIs
    sandboxService.ts   Docker preflight for validation
    agentService.ts     utility process transport
    clock.ts            time and id generation
  useCases/             one class per operation, single execute()
    workspaces/ settings/ providers/ runs/
  agent/                utilityProcess entry and modules
shared/                 types, channel names, API contract
src/                    renderer (React)
```

Dependency rule: `entities` depend on nothing. `services` depend on `entities`.
`useCases` depend on `entities` and `services`. `ipc` depends only on `useCases`.
`bootstrap` is the only place that instantiates services and use cases. Never the
reverse.

### Use cases and services

- A use case is a class named `<Verb><Noun>UseCase`. Its constructor receives the
  services it needs; its **single public method is `execute(...)`**.
- The use case owns the business rules: validation, state transitions, guardrails
  and the composition of services for one feature.
- A service wraps one external concern and never decides product rules. It has no
  knowledge of `BrowserWindow`, IPC channels or the renderer.
- Entities are pure modules: types, invariants, factories and small helpers. They
  import nothing from services or use cases.
- An IPC handler reads the arguments, calls one use case and returns the result.
  No SQL, no `fetch`, no process management.
- `bootstrap.ts` is the composition root: services are created once, use cases
  receive them by constructor, and the agent event handlers are wired there.

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
- Services are the only code that writes SQL.
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
| Entities | Pure unit tests |
| Use cases | Unit tests with fake services |
| Services | Integration tests: temporary SQLite, recorded provider responses |
| IPC | One smoke test per namespace |

A use case that cannot be tested without Electron is a sign the dependency is in
the wrong layer: it should receive a service, not a `BrowserWindow`.

## Evolution

- M1 adds `agent/` as a `utilityProcess`, with its own memory space and the same
  event contract.
- M3 adds Docker and Gatling adapters under `services/`; use cases only see a
  `ContainerService` and a validator service.
- If a second window is ever needed, `window.ts` already isolates creation from
  lifecycle.
