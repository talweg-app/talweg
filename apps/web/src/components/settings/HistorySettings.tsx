import { useEffect, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation.js";
import { historyRequest } from "../../utils/projectHistory.js";
import { DEFAULT_HISTORY_POLICY, parseHistoryPolicy, type HistoryPolicy } from "../../types/projectHistory.js";
import { Toggle } from "./controls.js";

export function HistorySettings() {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState<HistoryPolicy | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void historyRequest("/settings", { signal: controller.signal }).then(async response => {
      const next = parseHistoryPolicy(await response.json());
      if (!controller.signal.aborted) setPolicy(next);
    }).catch(() => { if (!controller.signal.aborted) setStatus("localOnly"); });
    return () => { controller.abort(); };
  }, []);
  const save = async () => {
    if (!policy) return;
    setBusy(true); setStatus("");
    try {
      const response = await historyRequest("/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(policy) });
      setPolicy(parseHistoryPolicy(await response.json())); setStatus("settingsSaved");
    } catch { setStatus("settingsError"); }
    finally { setBusy(false); }
  };
  return <div className="history-settings">
    <h4>{t("history.title")}</h4><p>{t("history.policyHint")}</p>
    {policy ? <>
      <Toggle label={t("history.automaticEnabled")} checked={policy.enabled} onChange={enabled => { setPolicy({ ...policy, enabled }); }} />
      <div className="history-policy-grid">
        <label className="settings-field"><span>{t("history.interval")}</span><select value={policy.intervalMinutes} onChange={event => { setPolicy({ ...policy, intervalMinutes: Number(event.target.value) }); }}>{[1, 5, 10, 15, 30, 60].map(minutes => <option key={minutes} value={minutes}>{minutes} {t("history.minutes")}</option>)}</select></label>
        <label className="settings-field"><span>{t("history.limitCount")}</span><input type="number" min={5} max={500} value={policy.maxVersions} onChange={event => { setPolicy({ ...policy, maxVersions: Number(event.target.value) }); }} /></label>
        <label className="settings-field"><span>{t("history.limitSize")}</span><input type="number" min={16} max={4096} value={policy.maxStorageMb} onChange={event => { setPolicy({ ...policy, maxStorageMb: Number(event.target.value) }); }} /></label>
      </div>
      <small>{t("history.retentionHint")}</small><button type="button" disabled={busy} onClick={() => { void save(); }}>{t(busy ? "history.saving" : "history.applyPolicy")}</button>
    </> : !status && <p role="status">{t("dashboard.loading")}</p>}
    {!policy && status && <button type="button" onClick={() => { setPolicy({ ...DEFAULT_HISTORY_POLICY }); setStatus(""); }}>{t("history.useDefaults")}</button>}
    {status && <p role={status === "localOnly" ? undefined : "status"}>{t(`history.${status}`)}</p>}
  </div>;
}
