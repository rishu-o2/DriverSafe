import { useCallback, useEffect, useState } from "react";
import {
  getCurrentRecording,
  getRecordingProtocol,
  startRecording,
  stopRecording,
} from "../lib/api";
import type { RecordingProtocol, RecordingStatus } from "../lib/api";

const emptyStatus: RecordingStatus = {
  active: false,
  session_id: null,
  subject_id: null,
  label: null,
  step: null,
  instruction: null,
  seconds_remaining: 0,
};

export function RecordingControls() {
  const [protocol, setProtocol] = useState<RecordingProtocol | null>(null);
  const [recording, setRecording] = useState<RecordingStatus>(emptyStatus);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [glasses, setGlasses] = useState("no");
  const [lighting, setLighting] = useState("normal");
  const [cameraAngle, setCameraAngle] = useState("frontal");
  const [error, setError] = useState("");

  const refreshStatus = useCallback(async () => {
    try {
      setRecording(await getCurrentRecording());
      setError("");
    } catch {
      setError("Recording service is unavailable.");
    }
  }, []);

  useEffect(() => {
    void getRecordingProtocol().then(setProtocol).catch(() => setError("Recording service is unavailable."));
    void refreshStatus();
    const timer = window.setInterval(() => { void refreshStatus(); }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  const begin = async () => {
    setError("");
    try {
      const nextStatus = await startRecording({
        consent_accepted: consentAccepted,
        glasses: glasses === "yes",
        lighting,
        camera_angle: cameraAngle,
      });
      setRecording(nextStatus);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to start recording.");
    }
  };

  const stop = async () => {
    setError("");
    try {
      setRecording(await stopRecording());
    } catch {
      setError("Unable to stop recording.");
    }
  };

  return (
    <section className="dashboard-analytics-panel" aria-label="Labeled feature recording">
      <div className="dashboard-analytics-panel-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Offline evaluation data</p>
          <h2>Feature recording</h2>
        </div>
      </div>
      <p role="note">{protocol?.consent_notice ?? "Recording stores derived facial features only, never camera video or images. Remain parked and do not perform these actions while driving."}</p>
      {!recording.active && (
        <div>
          <label>Glasses&nbsp;
            <select value={glasses} onChange={(event) => setGlasses(event.target.value)}>
              <option value="no">No</option><option value="yes">Yes</option>
            </select>
          </label>
          <label>Lighting&nbsp;
            <select value={lighting} onChange={(event) => setLighting(event.target.value)}>
              {(protocol?.lighting_options ?? ["bright", "normal", "dim", "mixed", "other"]).map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>Camera angle&nbsp;
            <select value={cameraAngle} onChange={(event) => setCameraAngle(event.target.value)}>
              {(protocol?.camera_angle_options ?? ["frontal", "slight_left", "slight_right", "above", "below", "other"]).map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />
            I have read the notice and consent to feature recording.
          </label>
        </div>
      )}
      {recording.active && (
        <div role="status" aria-live="polite">
          <strong>Step {recording.step} of {recording.step_count}: {recording.label}</strong>
          <p>{recording.instruction}</p>
          <p>{recording.seconds_remaining} seconds remaining</p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {recording.active
        ? <button type="button" onClick={() => void stop()}>Stop recording</button>
        : <button type="button" disabled={!consentAccepted || !protocol} onClick={() => void begin()}>Start recording</button>}
    </section>
  );
}
