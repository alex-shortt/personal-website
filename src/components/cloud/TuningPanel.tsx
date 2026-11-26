import {
  startTrace,
  stopTrace,
  downloadTrace,
  subscribeTrace,
  traceRecording,
  traceAvailable,
} from "./interactionTrace";
import { useState, useSyncExternalStore } from "react";
import {
  checkpoints,
  checkpointValues,
  serializeTuning,
  tuningGroups,
  type Tuning,
} from "./tuning";
import styles from "./TuningPanel.module.css";
export default function TuningPanel({
  values,
  onChange,
  checkpoint,
  onCheckpointChange,
}: {
  checkpoint: string;
  onCheckpointChange: (id: string) => void;
  values: Tuning;
  onChange: (value: Tuning) => void;
}) {
  const recording = useSyncExternalStore(
    subscribeTrace,
    traceRecording,
    () => false,
  );
  const hasTrace = useSyncExternalStore(
    subscribeTrace,
    traceAvailable,
    () => false,
  );
  const [status, setStatus] = useState("");
  const [showJSON, setShowJSON] = useState(false);
  const json = serializeTuning(values, checkpoint);
  const update = (key: string, value: Tuning[string]) => {
    const next = { ...values, [key]: value };
    if (key === "motionPaused" && value === true) {
      const currentTime = Number(
        document.querySelector("canvas")?.dataset.cloudTime,
      );
      if (Number.isFinite(currentTime)) next.motionTime = currentTime;
    }
    if (key === "motionTime") next.motionPaused = true;
    onChange(next);
    setStatus("");
  };
  return (
    <aside className={styles.panel} aria-label="Cloud tuning">
      <details open>
        <summary>Cloud controls</summary>
        <div className={styles.body}>
          <p>
            Edits saved separately for each checkpoint. Filmic and ambient
            affect the cloud only. Units: metres; cone angles are half-angles.
          </p>
          <label className={styles.control}>
            <span>Checkpoint</span>
            <select
              aria-label="Checkpoint"
              value={checkpoint}
              onChange={(e) => {
                onCheckpointChange(e.target.value);
                setStatus("");
              }}
            >
              {checkpoints.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.actions}>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(json);
                  setStatus("Copied settings");
                } catch {
                  setShowJSON(true);
                  setStatus("Select and copy the JSON below");
                }
              }}
            >
              Copy settings
            </button>
            <button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([json], { type: "application/json" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `cloud-settings-${checkpoint}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Download JSON
            </button>
            <button onClick={() => setShowJSON(!showJSON)}>Show JSON</button>
            <button
              onClick={() => {
                onChange({ ...checkpointValues(checkpoint) });
                setStatus(`Restored ${checkpoint}`);
              }}
            >
              Reset checkpoint
            </button>
          </div>
          <span role="status">{status}</span>
          {showJSON && (
            <textarea
              aria-label="Settings JSON"
              readOnly
              value={json}
              onFocus={(e) => e.target.select()}
              rows={10}
            />
          )}
          <details className={styles.group} open>
            <summary>Record mouse interaction</summary>
            <p>
              Records up to 20 seconds of pointer samples, fluid responses,
              camera state and frame timing. Start, move onto the cloud, and
              reproduce the problem. Nothing is uploaded.
            </p>
            <div className={styles.actions}>
              <button
                onClick={() =>
                  recording ? stopTrace() : startTrace(values, checkpoint)
                }
              >
                {recording ? "Stop recording" : "Record mouse trace"}
              </button>
              <button disabled={!hasTrace || recording} onClick={downloadTrace}>
                Download mouse trace
              </button>
            </div>
            <span role="status">
              {recording
                ? "Recording… stops automatically after 20 seconds."
                : hasTrace
                  ? "Trace ready to download."
                  : ""}
            </span>
          </details>
          {tuningGroups.map((g) => (
            <details key={g.label} className={styles.group}>
              <summary>{g.label}</summary>
              {g.description && <p>{g.description}</p>}
              {g.controls.map((c) => (
                <label className={styles.control} key={c.key}>
                  <span>{c.label}</span>
                  {c.options ? (
                    <select
                      aria-label={`${g.label}: ${c.label}`}
                      value={String(values[c.key])}
                      onChange={(e) => update(c.key, e.target.value)}
                    >
                      {c.options.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : typeof c.value === "boolean" ? (
                    <input
                      aria-label={`${g.label}: ${c.label}`}
                      type="checkbox"
                      checked={Boolean(values[c.key])}
                      onChange={(e) => update(c.key, e.target.checked)}
                    />
                  ) : typeof c.value === "string" ? (
                    <input
                      aria-label={`${g.label}: ${c.label}`}
                      type="color"
                      value={String(values[c.key])}
                      onChange={(e) => update(c.key, e.target.value)}
                    />
                  ) : (
                    <>
                      <input
                        aria-label={`${g.label}: ${c.label} slider`}
                        type="range"
                        min={c.min}
                        max={c.max}
                        step={c.step}
                        value={Number(values[c.key])}
                        onChange={(e) => update(c.key, Number(e.target.value))}
                      />
                      <input
                        aria-label={`${g.label}: ${c.label}`}
                        type="number"
                        min={c.min}
                        max={c.max}
                        step={c.step}
                        value={Number(values[c.key])}
                        onChange={(e) => {
                          const v = e.target.valueAsNumber;
                          if (Number.isFinite(v))
                            update(
                              c.key,
                              Math.max(c.min!, Math.min(c.max!, v)),
                            );
                        }}
                      />
                    </>
                  )}
                </label>
              ))}
            </details>
          ))}
        </div>
      </details>
      <script id="cloud-tuning-state" type="application/json">
        {json}
      </script>
    </aside>
  );
}
