"""Replay account-owned feature recordings through the production detector."""

import csv
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from sqlalchemy import select

from database import RecordingFrame, RecordingSession, SessionLocal
from evaluation.metrics import classification_metrics
from routers import detection
from utils.live_session import LiveSession


BACKEND_DIR = Path(__file__).resolve().parents[1]
RESULTS_DIR = Path(__file__).resolve().parent / "results"
HEADS = ("autoencoder", "isolation_forest", "lof", "ensemble", "rules")
POSITIVE_LABELS = {"drowsy_eyes", "drowsy_yawn", "drowsy_nod"}
COOLDOWN_SECONDS = detection.ALERT_COOLDOWN_SECONDS
MAX_REPLAY_FRAME_GAP_SECONDS = 1.0


def _aware(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def load_recorded_sessions():
    sessions = []
    with SessionLocal() as db:
        recordings = db.scalars(select(RecordingSession).order_by(RecordingSession.started_at)).all()
        for recording in recordings:
            frames = db.scalars(
                select(RecordingFrame)
                .where(RecordingFrame.session_id == recording.id)
                .order_by(RecordingFrame.timestamp, RecordingFrame.id)
            ).all()
            if not frames:
                continue
            sessions.append({
                "session_id": recording.id,
                "subject_id": recording.subject_id,
                "metadata": {
                    "glasses": recording.glasses,
                    "lighting": recording.lighting,
                    "camera_angle": recording.camera_angle,
                },
                "frames": [{
                    "timestamp": _aware(frame.timestamp),
                    "label": frame.label,
                    "features": frame.features,
                } for frame in frames],
            })
    return sessions


def _replay_session(recording):
    calibration = LiveSession()
    tracker = detection.LiveStreamTracker()
    first_timestamp = recording["frames"][0]["timestamp"]
    calibration_clock_origin = 10_000.0
    rows = []
    previous_face_timestamp = None
    previous_evaluated_timestamp = None

    for index, frame in enumerate(recording["frames"], start=1):
        label = frame["label"]
        timestamp = frame["timestamp"]
        gap = (
            (timestamp - previous_face_timestamp).total_seconds()
            if previous_face_timestamp is not None else 0.0
        )
        has_face_gap = gap > MAX_REPLAY_FRAME_GAP_SECONDS
        if has_face_gap:
            calibration.note_calibration_gap()
            tracker.reset_on_missing_face()
        previous_face_timestamp = timestamp
        if label == "calibration":
            elapsed = (timestamp - first_timestamp).total_seconds()
            calibration.observe_calibration_frame(
                frame["features"],
                detection.CALIBRATION_SECONDS,
                timestamp=calibration_clock_origin + elapsed,
            )
            continue
        if label not in {"normal", *POSITIVE_LABELS}:
            continue
        if calibration.get_calibration_state(detection.CALIBRATION_SECONDS)["phase"] != "active":
            continue

        result = detection.process_features(
            index,
            np.asarray(frame["features"], dtype=np.float32),
            tracker,
            calibration.get_calibration_baseline(),
            timestamp=timestamp.timestamp(),
        )
        model_alerts = result.get("model_alerts", {})
        rows.append({
            "session_id": recording["session_id"],
            "subject_id": recording["subject_id"],
            "metadata": recording["metadata"],
            "timestamp": timestamp,
            "break_before": bool(
                previous_evaluated_timestamp is not None
                and (timestamp - previous_evaluated_timestamp).total_seconds() > MAX_REPLAY_FRAME_GAP_SECONDS
            ),
            "label": label,
            "actual": label in POSITIVE_LABELS,
            "predictions": {
                "autoencoder": bool(model_alerts.get("autoencoder", False)),
                "isolation_forest": bool(model_alerts.get("isolation_forest", False)),
                "lof": bool(model_alerts.get("lof", False)),
                "ensemble": bool(result.get("ensemble_alert", False)),
                "rules": bool(result.get("rule_alert", False)),
            },
            "scores": {
                "autoencoder": float(result["ae_error"]),
                "isolation_forest": -float(result["if_score"]),
                "lof": -float(result["lof_score"]),
            },
            "votes": int(result.get("votes", 0)),
            "severity": float(result.get("confidence", 0.0)),
        })
        previous_evaluated_timestamp = timestamp
    return rows


def _ground_truth_episodes(rows):
    episodes = []
    active = []
    for row in rows:
        if row["actual"]:
            if active and (
                row.get("break_before")
                or (row["timestamp"] - active[-1]["timestamp"]).total_seconds() > MAX_REPLAY_FRAME_GAP_SECONDS
            ):
                episodes.append(active)
                active = []
            active.append(row)
        elif active:
            episodes.append(active)
            active = []
    if active:
        episodes.append(active)
    return episodes


def _predicted_episodes(rows, head):
    events = []
    tracker = LiveSession()
    previous_timestamp = None
    for row in rows:
        gap = (
            (row["timestamp"] - previous_timestamp).total_seconds()
            if previous_timestamp is not None else 0.0
        )
        if row.get("break_before") or gap > MAX_REPLAY_FRAME_GAP_SECONDS:
            tracker.update_episode(False, 0, COOLDOWN_SECONDS, timestamp=row["timestamp"])
        event = tracker.update_episode(
            row["predictions"][head],
            row["severity"],
            COOLDOWN_SECONDS,
            timestamp=row["timestamp"],
        )
        if event and event["action"] == "started":
            events.append({
                "timestamp": event["timestamp"],
                "alert_event": bool(event["alert_event"]),
            })
        previous_timestamp = row["timestamp"]
    if rows:
        tracker.update_episode(
            False,
            0,
            COOLDOWN_SECONDS,
            timestamp=rows[-1]["timestamp"] + timedelta(microseconds=1),
        )
    return events


def _normal_duration_seconds(rows):
    total = 0.0
    by_session = defaultdict(list)
    for row in rows:
        if row["label"] == "normal":
            by_session[row["session_id"]].append(row["timestamp"])
    for timestamps in by_session.values():
        for before, after in zip(timestamps, timestamps[1:]):
            gap = (after - before).total_seconds()
            if 0 < gap <= MAX_REPLAY_FRAME_GAP_SECONDS:
                total += gap
    return total


def _episode_metrics(rows, head):
    gt_episodes = []
    rows_by_session = defaultdict(list)
    for row in rows:
        rows_by_session[row["session_id"]].append(row)
    for session_rows in rows_by_session.values():
        gt_episodes.extend(_ground_truth_episodes(session_rows))

    matched_delays = []
    normal_alarm_count = 0
    predicted_count = 0
    for session_rows in rows_by_session.values():
        events = _predicted_episodes(session_rows, head)
        predicted_count += len(events)
        labels_by_timestamp = {row["timestamp"]: row["label"] for row in session_rows}
        normal_alarm_count += sum(
            event["alert_event"] and labels_by_timestamp.get(event["timestamp"]) == "normal"
            for event in events
        )

    for episode in gt_episodes:
        hits = [row["timestamp"] for row in episode if row["predictions"][head]]
        if hits:
            matched_delays.append(max(0.0, (min(hits) - episode[0]["timestamp"]).total_seconds()))

    normal_seconds = _normal_duration_seconds(rows)
    return {
        "ground_truth_episodes": len(gt_episodes),
        "predicted_episodes": predicted_count,
        "episodes_detected": len(matched_delays),
        "episodes_missed": len(gt_episodes) - len(matched_delays),
        "detection_delay_seconds_mean": sum(matched_delays) / len(matched_delays) if matched_delays else None,
        "detection_delay_seconds": matched_delays,
        "normal_frames": sum(row["label"] == "normal" for row in rows),
        "normal_seconds": normal_seconds,
        "false_alarm_events": normal_alarm_count,
        "false_alarms_per_hour": normal_alarm_count / (normal_seconds / 3600) if normal_seconds > 0 else None,
    }


def _metrics_for_group(rows):
    result = {
        "frames": len(rows),
        "subjects": len({row["subject_id"] for row in rows}),
        "sessions": len({row["session_id"] for row in rows}),
        "positive_episodes": sum(len(_ground_truth_episodes(items)) for items in _rows_by_session(rows).values()),
        "models": {},
        "warnings": [],
    }
    actual = [row["actual"] for row in rows]
    if len(rows) < 100:
        result["warnings"].append("Fewer than 100 labeled frames; estimates are low-confidence.")
    if sum(actual) < 20 or len(actual) - sum(actual) < 20:
        result["warnings"].append("Fewer than 20 positive or negative frames; class metrics may be unstable or undefined.")
    if result["positive_episodes"] < 5:
        result["warnings"].append("Fewer than five labeled positive episodes; episode metrics are low-confidence.")

    for head in HEADS:
        predictions = [row["predictions"][head] for row in rows]
        scores = [row["scores"][head] for row in rows] if head in {"autoencoder", "isolation_forest", "lof"} else None
        result["models"][head] = {
            **classification_metrics(actual, predictions, scores),
            **_episode_metrics(rows, head),
        }
        if scores is not None and result["models"][head]["roc_auc"] is None:
            result["warnings"].append(f"{head}: ROC-AUC and PR-AUC require both positive and negative frames.")
    return result


def _rows_by_session(rows):
    sessions = defaultdict(list)
    for row in rows:
        sessions[row["session_id"]].append(row)
    return sessions


def _group_metrics(rows, key_fn):
    groups = defaultdict(list)
    for row in rows:
        groups[str(key_fn(row))].append(row)
    return {key: _metrics_for_group(group) for key, group in sorted(groups.items())}


def _threshold_sweep(rows):
    output = []
    for vote_threshold in (1, 2, 3):
        threshold_rows = []
        for row in rows:
            copy = dict(row)
            copy["predictions"] = {**row["predictions"], "ensemble": row["votes"] >= vote_threshold}
            threshold_rows.append(copy)
        episode = _episode_metrics(threshold_rows, "ensemble")
        output.append({
            "minimum_votes": vote_threshold,
            "vote_fraction_threshold": vote_threshold / 3,
            "recall": classification_metrics(
                [row["actual"] for row in threshold_rows],
                [row["predictions"]["ensemble"] for row in threshold_rows],
            )["recall"],
            "false_alarms_per_hour": episode["false_alarms_per_hour"],
            "false_alarm_events": episode["false_alarm_events"],
            "normal_seconds": episode["normal_seconds"],
        })
    return output


def _svg_plot(sweep):
    width, height = 720, 420
    left, right, top, bottom = 90, 30, 30, 70
    plot_width, plot_height = width - left - right, height - top - bottom
    valid = [point for point in sweep if point["false_alarms_per_hour"] is not None]
    if not valid:
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}"><text x="30" y="60">No normal-duration data is available for the threshold sweep.</text></svg>\n'
    maximum_x = max(1.0, max(point["false_alarms_per_hour"] for point in valid))
    points = []
    for point in valid:
        x = left + point["false_alarms_per_hour"] / maximum_x * plot_width
        y = top + (1 - point["recall"]) * plot_height
        points.append((x, y, point))
    polyline = " ".join(f"{x:.1f},{y:.1f}" for x, y, _ in points)
    marks = "".join(
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="#167f9c"/><text x="{x + 8:.1f}" y="{y - 8:.1f}" font-size="12">{p["minimum_votes"]} vote(s)</text>'
        for x, y, p in points
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        '<rect width="100%" height="100%" fill="white"/>'
        f'<line x1="{left}" y1="{top}" x2="{left}" y2="{top + plot_height}" stroke="#555"/>'
        f'<line x1="{left}" y1="{top + plot_height}" x2="{left + plot_width}" y2="{top + plot_height}" stroke="#555"/>'
        f'<polyline points="{polyline}" fill="none" stroke="#167f9c" stroke-width="2"/>{marks}'
        f'<text x="{left + plot_width / 2}" y="{height - 20}" text-anchor="middle">False alert events per normal hour</text>'
        f'<text x="20" y="{top + plot_height / 2}" transform="rotate(-90 20,{top + plot_height / 2})" text-anchor="middle">Recall</text>'
        f'<text x="{left - 10}" y="{top + plot_height + 5}" text-anchor="end">0</text>'
        f'<text x="{left - 10}" y="{top + 8}" text-anchor="end">1</text></svg>\n'
    )


def _synthetic_comparison():
    path = BACKEND_DIR / "saved_models" / "results.json"
    if not path.is_file():
        return {"available": False, "note": "No saved synthetic evaluation results file was found."}
    try:
        saved = json.loads(path.read_text(encoding="utf-8"))
        return {
            "available": True,
            "source": "backend/saved_models/results.json",
            "note": "Synthetic-data training/evaluation results; reported separately and not combined with recorded-session metrics.",
            "detection": saved.get("detection"),
            "model_comparison": saved.get("model_comparison"),
        }
    except (OSError, json.JSONDecodeError):
        return {"available": False, "note": "Synthetic evaluation results could not be read."}


def _build_report(result):
    overall = result["overall"]
    lines = [
        "# DriverSafe offline evaluation",
        "",
        f"Data: {result['data']['frames']} evaluated frames from {result['data']['recordings']} recordings and {result['data']['subjects']} subjects.",
        "Calibration frames were skipped. Models were loaded read-only and were not retrained.",
        "",
        "## Overall frame and episode metrics",
        "",
        "| Detector | Frames | Precision | Recall | F1 | ROC-AUC | PR-AUC | Episodes detected/missed | False alarms/hour |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    fmt = lambda value: "n/a" if value is None else f"{value:.3f}"
    for head, metrics in overall["models"].items():
        lines.append(
            f"| {head} | {metrics['frames']} | {fmt(metrics['precision'])} | {fmt(metrics['recall'])} | {fmt(metrics['f1'])} | {fmt(metrics['roc_auc'])} | {fmt(metrics['pr_auc'])} | {metrics['episodes_detected']}/{metrics['episodes_missed']} | {fmt(metrics['false_alarms_per_hour'])} |"
        )
    lines.extend(["", "## Threshold sweep", "", "![Ensemble recall versus false alarms per normal hour](threshold_sweep.svg)", "", "| Minimum model votes | Recall | False alarms/hour | Normal seconds |", "|---:|---:|---:|---:|"])
    for point in result["threshold_sweep"]:
        lines.append(f"| {point['minimum_votes']} | {fmt(point['recall'])} | {fmt(point['false_alarms_per_hour'])} | {point['normal_seconds']:.1f} |")
    lines.extend(["", "## Data warnings", ""])
    warnings = overall["warnings"] or ["None for the overall aggregate; inspect per-subject and per-condition warnings."]
    lines.extend(f"- {warning}" for warning in warnings)
    synthetic = result["synthetic_comparison"]
    lines.extend(["", "## Existing synthetic-data result (separate comparison)", "", synthetic.get("note", "Unavailable.")])
    if synthetic.get("available"):
        lines.append(f"Synthetic detection F1: {fmt((synthetic.get('detection') or {}).get('f1_score'))}. This value is not pooled with recorded data.")
    lines.extend(["", "Per-subject and per-condition tables are in `evaluation.json` and `evaluation.csv`.", ""])
    return "\n".join(lines)


def _flatten_csv(result):
    rows = []
    groups = [("overall", "all", result["overall"])]
    groups.extend(("subject", key, value) for key, value in result["per_subject"].items())
    for condition, values in result["per_condition"].items():
        groups.extend((condition, key, value) for key, value in values.items())
    for scope, group, summary in groups:
        for head, metrics in summary["models"].items():
            rows.append({
                "scope": scope,
                "group": group,
                "detector": head,
                "frames": metrics["frames"],
                "positive_frames": metrics["positive_frames"],
                "negative_frames": metrics["negative_frames"],
                "precision": metrics["precision"],
                "recall": metrics["recall"],
                "f1": metrics["f1"],
                "tp": metrics["confusion"]["tp"],
                "fp": metrics["confusion"]["fp"],
                "fn": metrics["confusion"]["fn"],
                "tn": metrics["confusion"]["tn"],
                "roc_auc": metrics["roc_auc"],
                "pr_auc": metrics["pr_auc"],
                "episodes": metrics["ground_truth_episodes"],
                "episodes_detected": metrics["episodes_detected"],
                "episodes_missed": metrics["episodes_missed"],
                "mean_detection_delay_seconds": metrics["detection_delay_seconds_mean"],
                "normal_seconds": metrics["normal_seconds"],
                "false_alarms_per_hour": metrics["false_alarms_per_hour"],
                "warnings": " | ".join(summary["warnings"]),
            })
    return rows


def evaluate():
    recordings = load_recorded_sessions()
    if not recordings:
        print("No recording feature frames found. Start and complete a labeled recording before evaluation.")
        return 2

    detection.load_models()
    if not detection._MODELS_LOADED:
        print("Inference models could not be loaded; evaluation stopped without writing results.")
        return 2

    rows = []
    used_recordings = 0
    for recording in recordings:
        replayed = _replay_session(recording)
        if replayed:
            rows.extend(replayed)
            used_recordings += 1
    if not rows:
        print("No evaluable normal/drowsy frames remain after calibration; no results were written.")
        return 2

    per_subject = _group_metrics(rows, lambda row: row["subject_id"])
    per_condition = {
        "glasses": _group_metrics(rows, lambda row: row["metadata"]["glasses"]),
        "lighting": _group_metrics(rows, lambda row: row["metadata"]["lighting"]),
        "camera_angle": _group_metrics(rows, lambda row: row["metadata"]["camera_angle"]),
    }
    overall = _metrics_for_group(rows)
    subject_ids = sorted({row["subject_id"] for row in rows})
    result = {
        "data": {
            "frames": len(rows),
            "recordings": used_recordings,
            "subjects": len(subject_ids),
            "normal_frames": sum(row["label"] == "normal" for row in rows),
            "positive_frames": sum(row["actual"] for row in rows),
            "positive_episodes": overall["positive_episodes"],
        },
        "overall": overall,
        "per_subject": per_subject,
        "per_condition": per_condition,
        "leave_one_subject_out": {
            "method": "Fixed-model, inference-only held-out subject slices; no fold retraining is performed.",
            "folds": per_subject,
            "warning": "This is not cross-validation of fitted models. Retraining is excluded by the recording evaluation requirements.",
        },
        "threshold_sweep": _threshold_sweep(rows),
        "synthetic_comparison": _synthetic_comparison(),
        "method": {
            "calibration_frames_skipped": True,
            "inference_path": "routers.detection.process_features",
            "calibration_and_episodes": "utils.live_session.LiveSession",
            "no_face_handling": f"Feature-only recordings omit no-face frames; replay resets on timestamp gaps over {MAX_REPLAY_FRAME_GAP_SECONDS:g} second(s).",
            "cooldown_seconds": COOLDOWN_SECONDS,
            "synthetic_data_mixed": False,
            "models_modified": False,
        },
    }

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (RESULTS_DIR / "evaluation.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    csv_rows = _flatten_csv(result)
    with (RESULTS_DIR / "evaluation.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=list(csv_rows[0]))
        writer.writeheader()
        writer.writerows(csv_rows)
    (RESULTS_DIR / "threshold_sweep.svg").write_text(_svg_plot(result["threshold_sweep"]), encoding="utf-8")
    (RESULTS_DIR / "report.md").write_text(_build_report(result), encoding="utf-8")
    print(f"Evaluated {len(rows)} frames from {used_recordings} recordings and {len(subject_ids)} subjects.")
    for warning in overall["warnings"]:
        print(f"WARNING: {warning}")
    print(f"Results written to {RESULTS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(evaluate())
