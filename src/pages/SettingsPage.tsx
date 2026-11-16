import { useEffect, useState } from "react";
import {
  PROVIDERS,
  type ProviderId,
  type Settings,
} from "../../shared/types";
import { Button } from "../components/Button";
import { Field, Panel } from "../components/ui";
import { errorMessage } from "../lib/format";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState<ProviderId>("anthropic");
  const [keyDraft, setKeyDraft] = useState("");
  const [baseUrlDraft, setBaseUrlDraft] = useState("");
  const [budget, setBudget] = useState("");
  const [runBudget, setRunBudget] = useState("");
  const [allowInvalid, setAllowInvalid] = useState(false);
  const [dockerHost, setDockerHost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const current = await window.defensity.getSettings();
      setSettings(current);
      setBudget(String(current.compactionBudget));
      setRunBudget(String(current.runTokenBudget));
      setAllowInvalid(current.allowInvalidCertificates);
      setDockerHost(current.dockerHost);
      setBaseUrlDraft(current.compatibleBaseUrl);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const provider = PROVIDERS.find((item) => item.id === selected) ?? PROVIDERS[0];
  const hasKey = settings?.providerKeys[selected] ?? false;

  async function saveKey() {
    if (!keyDraft.trim()) {
      return;
    }
    setBusy("key");
    setError(null);
    try {
      await window.defensity.setProviderKey(selected, keyDraft);
      setKeyDraft("");
      await load();
      setNotice(`API key for ${provider.label} stored in the OS keychain.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function clearKey() {
    setBusy("clear");
    setError(null);
    try {
      await window.defensity.clearProviderKey(selected);
      await load();
      setNotice(`API key for ${provider.label} removed.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function saveBaseUrl() {
    setBusy("base");
    setError(null);
    try {
      const updated = await window.defensity.saveSettings({
        compatibleBaseUrl: baseUrlDraft,
      });
      setSettings(updated);
      setNotice("Base URL saved.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function saveEngine() {
    setBusy("engine");
    setError(null);
    try {
      const updated = await window.defensity.saveSettings({
        compactionBudget: Number(budget),
        runTokenBudget: Number(runBudget),
        allowInvalidCertificates: allowInvalid,
        dockerHost,
      });
      setSettings(updated);
      setNotice("Engine settings saved.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  const connectedCount = settings
    ? PROVIDERS.filter((item) => settings.providerKeys[item.id]).length
    : 0;

  return (
    <div className="page">
      {error ? <div className="alert">{error}</div> : null}
      {notice && !error ? (
        <div className="alert alert--info">{notice}</div>
      ) : null}

      <Panel
        title="Model providers"
        meta={`${connectedCount} of ${PROVIDERS.length} connected`}
      >
        <div className="stack">
          <Field
            label="Provider"
            htmlFor="provider-select"
            hint="Choose one provider to configure. Keys are stored in the OS keychain."
          >
            <select
              id="provider-select"
              className="select"
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value as ProviderId);
                setKeyDraft("");
                setNotice(null);
                setError(null);
              }}
            >
              {PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {settings?.providerKeys[item.id] ? " — connected" : ""}
                </option>
              ))}
            </select>
          </Field>

          <div className="provider-card">
            <div className="provider-head">
              <div>
                <b>{provider.label}</b>
                <div style={{ marginTop: 4 }}>
                  <span className={`status-dot${hasKey ? " on" : ""}`} />
                  <span className="hint">
                    {hasKey ? "Key stored" : "No key"}
                  </span>
                </div>
              </div>
              <span>{provider.endpoint}</span>
            </div>

            {selected === "compatible" ? (
              <Field
                label="Base URL"
                htmlFor="compatible-base-url"
                hint="OpenAI-compatible endpoint, for example https://api.example.com/v1"
              >
                <div className="path-row">
                  <input
                    id="compatible-base-url"
                    className="input"
                    value={baseUrlDraft}
                    onChange={(event) => setBaseUrlDraft(event.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === "base"}
                    disabled={busy !== null}
                    onClick={() => void saveBaseUrl()}
                  >
                    Save
                  </Button>
                </div>
              </Field>
            ) : null}

            <Field label="API key" htmlFor="provider-key">
              <div className="path-row">
                <input
                  id="provider-key"
                  className="input"
                  type="password"
                  value={keyDraft}
                  placeholder={provider.keyLabel}
                  onChange={(event) => setKeyDraft(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === "key"}
                  disabled={busy !== null || !keyDraft.trim()}
                  onClick={() => void saveKey()}
                >
                  Save
                </Button>
                {hasKey ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === "clear"}
                    disabled={busy !== null}
                    onClick={() => void clearKey()}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </Field>
          </div>
        </div>
      </Panel>

      <Panel title="Engine">
        <div className="stack">
          <Field
            label="Session compaction budget"
            htmlFor="compaction-budget"
            hint="Tokens per session. Compaction triggers at 80% of this value."
          >
            <input
              id="compaction-budget"
              className="input"
              type="number"
              min={20000}
              step={1000}
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </Field>
          <Field
            label="Run token budget"
            htmlFor="run-token-budget"
            hint="Hard cap per run. The run fails when the total exceeds this value."
          >
            <input
              id="run-token-budget"
              className="input"
              type="number"
              min={10000}
              step={10000}
              value={runBudget}
              onChange={(event) => setRunBudget(event.target.value)}
            />
          </Field>
          <Field
            label="TLS verification"
            hint="Enable only for test targets with self-signed certificates. Applies to agent requests and probe containers."
          >
            <label className="check">
              <input
                type="checkbox"
                checked={allowInvalid}
                onChange={(event) => setAllowInvalid(event.target.checked)}
              />
              Allow invalid certificates in requests
            </label>
          </Field>
          <Field
            label="Docker host"
            htmlFor="docker-host"
            hint="Docker is required. A run will not start while it is unavailable."
          >
            <input
              id="docker-host"
              className="input"
              value={dockerHost}
              onChange={(event) => setDockerHost(event.target.value)}
              placeholder="unix:///var/run/docker.sock"
            />
          </Field>
          <div>
            <Button
              variant="primary"
              loading={busy === "engine"}
              disabled={busy !== null}
              onClick={() => void saveEngine()}
            >
              Save settings
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Data">
        <p className="hint">
          Workspaces and artifacts are stored locally. Runs, events and findings
          are never deleted automatically; export is the archival path.
        </p>
      </Panel>
    </div>
  );
}
