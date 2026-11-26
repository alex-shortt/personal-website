import type { Tuning } from "./tuning";

type Trace = {
  schema: "cloud-pointer-trace";
  version: 1;
  checkpoint: string;
  settings: Tuning;
  viewport: { width: number; height: number; dpr: number };
  startedAt: string;
  durationMs: number;
  entries: { t: number; kind: string; data: unknown }[];
};
let trace: Trace | null = null;
let recording = false;
let start = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export const traceRecording = () => recording;
export const traceAvailable = () => trace !== null;
export function subscribeTrace(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function stopTrace() {
  if (!recording) return;
  recording = false;
  clearTimeout(timer);
  if (trace) trace.durationMs = performance.now() - start;
  notify();
}
export function startTrace(settings: Tuning, checkpoint: string) {
  stopTrace();
  start = performance.now();
  trace = {
    schema: "cloud-pointer-trace",
    version: 1,
    checkpoint,
    settings: { ...settings },
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    startedAt: new Date().toISOString(),
    durationMs: 0,
    entries: [],
  };
  recording = true;
  timer = setTimeout(stopTrace, 20000);
  notify();
}
export function recordTrace(kind: string, data: unknown) {
  if (!recording || !trace) return;
  trace.entries.push({ t: performance.now() - start, kind, data });
  if (trace.entries.length >= 60000) stopTrace();
}
export function downloadTrace() {
  stopTrace();
  if (!trace) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(trace)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "cloud-pointer-trace.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
