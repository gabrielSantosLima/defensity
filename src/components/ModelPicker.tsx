import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import {
  PROVIDERS,
  type ModelInfo,
  type ProviderId,
  type Settings,
  type ThinkingLevel,
} from "../../shared/types";
import { Button } from "./Button";
import { errorMessage } from "../lib/format";

export interface ModelSelection {
  provider: ProviderId | null;
  model: string | null;
  thinking: ThinkingLevel | null;
}

const THINKING_LEVELS: ThinkingLevel[] = ["off", "low", "medium", "high"];

function providerLabel(id: ProviderId): string {
  return PROVIDERS.find((provider) => provider.id === id)?.label ?? id;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function matches(query: string, model: ModelInfo): boolean {
  const search = normalize(query);
  if (!search) {
    return true;
  }
  const compact = search.replaceAll(" ", "");
  const fields = [
    normalize(model.name),
    normalize(model.id),
    normalize(providerLabel(model.provider)),
  ];
  return fields.some(
    (field) => field.includes(search) || field.replaceAll(" ", "").includes(compact),
  );
}

function groupModels(
  models: ModelInfo[],
): Array<{ provider: ProviderId; label: string; items: ModelInfo[] }> {
  const grouped = new Map<ProviderId, ModelInfo[]>();
  for (const model of models) {
    const list = grouped.get(model.provider) ?? [];
    list.push(model);
    grouped.set(model.provider, list);
  }
  return PROVIDERS.filter((provider) => grouped.has(provider.id)).map(
    (provider) => ({
      provider: provider.id,
      label: provider.label,
      items: grouped.get(provider.id) ?? [],
    }),
  );
}

interface ModelPickerProps {
  value: ModelSelection;
  onChange: (next: ModelSelection) => void;
}

export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await window.defensity.getSettings();
      setSettings(current);
      const connected = PROVIDERS.filter(
        (provider) => current.providerKeys[provider.id],
      );
      if (connected.length === 0) {
        setModels([]);
        return;
      }
      const results = await Promise.allSettled(
        connected.map((provider) => window.defensity.listModels(provider.id)),
      );
      const loaded = results.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );
      const failures = results.filter(
        (result) => result.status === "rejected",
      ).length;
      setModels(loaded);
      if (failures > 0 && loaded.length === 0) {
        const reason = results.find(
          (result) => result.status === "rejected",
        ) as PromiseRejectedResult | undefined;
        setError(
          reason ? errorMessage(reason.reason) : "Could not load models.",
        );
      } else if (failures > 0) {
        setError(`${failures} provider(s) could not be reached.`);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const filtered = useMemo(
    () => models.filter((model) => matches(query, model)),
    [models, query],
  );
  const groups = useMemo(() => groupModels(filtered), [filtered]);
  const flat = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups],
  );

  useEffect(() => {
    setActive(0);
  }, [query, models]);

  useEffect(() => {
    if (!open || !value.model) {
      return;
    }
    const index = flat.findIndex(
      (model) => model.provider === value.provider && model.id === value.model,
    );
    if (index >= 0) {
      setActive(index);
    }
  }, [open, value.provider, value.model, flat]);

  const connected = PROVIDERS.filter(
    (provider) => settings?.providerKeys[provider.id],
  );

  function choose(model: ModelInfo) {
    onChange({
      provider: model.provider,
      model: model.id,
      thinking: value.thinking ?? "off",
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(flat.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const model = flat[active];
      if (model) {
        choose(model);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const activeKey = flat[active]
    ? `${flat[active].provider}:${flat[active].id}`
    : null;

  return (
    <>
      <button
        type="button"
        className="model-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {value.model ? (
          <>
            <span className="value">{value.model}</span>
            <span className="meta">
              {value.provider ? providerLabel(value.provider) : "—"} ·{" "}
              {value.thinking ?? "off"}
            </span>
          </>
        ) : (
          <span className="placeholder">Select model…</span>
        )}
      </button>

      {open ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div
            className="modal model-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Select model"
          >
            <header className="modal-head">
              <span>Select model</span>
              <span className="meta">
                {connected.length} provider{connected.length === 1 ? "" : "s"}{" "}
                connected
              </span>
            </header>

            <div className="model-search">
              <input
                className="input"
                type="search"
                autoFocus
                value={query}
                placeholder="Search models, providers or IDs"
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>

            <div className="model-list">
              {loading ? (
                <div className="model-status">Loading models…</div>
              ) : connected.length === 0 ? (
                <div className="model-status">
                  No providers connected. Add an API key in Settings to list
                  models.
                </div>
              ) : flat.length === 0 ? (
                <div className="model-status">
                  {query
                    ? `No model matches “${query}”.`
                    : "No models returned by the connected providers."}
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.provider}>
                    <div className="model-group">{group.label}</div>
                    {group.items.map((model) => {
                      const key = `${model.provider}:${model.id}`;
                      const selected =
                        value.provider === model.provider &&
                        value.model === model.id;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={[
                            "model-row",
                            selected ? "on" : "",
                            key === activeKey ? "active" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => choose(model)}
                          onMouseEnter={() => setActive(flat.indexOf(model))}
                          aria-current={selected ? "true" : undefined}
                        >
                          <span className="name">{model.name}</span>
                          <span className="prov">{group.label}</span>
                          {selected ? <Check size={13} aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {error ? <div className="model-error">{error}</div> : null}

            <footer className="model-foot">
              <span className="lbl">Thinking</span>
              <div className="seg" role="group" aria-label="Thinking level">
                {THINKING_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={(value.thinking ?? "off") === level}
                    onClick={() => onChange({ ...value, thinking: level })}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <span style={{ flex: 1 }} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw size={12} aria-hidden="true" />
                Refresh
              </Button>
              <Button size="sm" variant="primary" onClick={() => setOpen(false)}>
                Done
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
