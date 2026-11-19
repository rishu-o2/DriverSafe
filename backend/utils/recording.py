"""Backend-owned, feature-only recording protocol and persistence."""

import math
import os
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import RecordingFrame, RecordingSession, RecordingSubject, SessionLocal


_STEP_DEFINITIONS = (
    ("calibration", "Look naturally and stay alert while seated and parked."),
    ("normal", "Continue a natural, alert expression and upright posture."),
    ("drowsy_eyes", "While parked, briefly demonstrate eye closure; do not do this while driving."),
    ("drowsy_yawn", "While parked, briefly simulate a yawn; do not do this while driving."),
    ("drowsy_nod", "While parked, gently demonstrate a head nod; do not do this while driving."),
)
RECORDING_LABELS = tuple(label for label, _ in _STEP_DEFINITIONS)

try:
    _DETECTOR_CALIBRATION_SECONDS = int(os.getenv("CALIBRATION_SECONDS", "30"))
except ValueError as exc:
    raise RuntimeError("CALIBRATION_SECONDS must be an integer from 30 to 60") from exc
if not 30 <= _DETECTOR_CALIBRATION_SECONDS <= 60:
    raise RuntimeError("CALIBRATION_SECONDS must be an integer from 30 to 60")

_DEFAULT_DURATIONS = (_DETECTOR_CALIBRATION_SECONDS, 60, 30, 30, 30)


def _load_durations():
    durations = []
    for (label, _), default in zip(_STEP_DEFINITIONS, _DEFAULT_DURATIONS):
        env_name = f"RECORDING_STEP_{label.upper()}_SECONDS"
        try:
            value = int(os.getenv(env_name, str(default)))
        except ValueError as exc:
            raise RuntimeError(f"{env_name} must be an integer from 1 to 3600") from exc
        if not 1 <= value <= 3600:
            raise RuntimeError(f"{env_name} must be an integer from 1 to 3600")
        durations.append(value)
    if sum(durations) > 1800:
        raise RuntimeError("Configured recording protocol must not exceed 1800 seconds")
    if durations[0] < _DETECTOR_CALIBRATION_SECONDS:
        raise RuntimeError("RECORDING_STEP_CALIBRATION_SECONDS must be at least CALIBRATION_SECONDS")
    return tuple(durations)


RECORDING_DURATIONS = _load_durations()


def utc_now():
    return datetime.now(timezone.utc)


def _as_utc(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _advance_protocol(recording, now):
    now = _as_utc(now)
    while recording.active:
        step_index = recording.step_index
        if step_index >= len(_STEP_DEFINITIONS):
            recording.active = False
            recording.stopped_at = now
            break
        step_started = _as_utc(recording.step_started_at)
        duration = RECORDING_DURATIONS[step_index]
        if (now - step_started).total_seconds() < duration:
            break
        recording.step_index += 1
        if recording.step_index >= len(_STEP_DEFINITIONS):
            recording.active = False
            recording.stopped_at = now
            break
        recording.step_started_at = step_started + timedelta(seconds=duration)
        recording.current_label = _STEP_DEFINITIONS[recording.step_index][0]


def _status(recording, now=None):
    if recording is None or not recording.active:
        return {"active": False, "session_id": None, "label": None, "step": None, "instruction": None, "seconds_remaining": 0, "subject_id": None}
    now = _as_utc(now or utc_now())
    index = recording.step_index
    step_started = _as_utc(recording.step_started_at)
    while index < len(_STEP_DEFINITIONS):
        duration = RECORDING_DURATIONS[index]
        if (now - step_started).total_seconds() < duration:
            break
        step_started += timedelta(seconds=duration)
        index += 1
    if index >= len(_STEP_DEFINITIONS):
        return {"active": False, "session_id": None, "label": None, "step": None, "instruction": None, "seconds_remaining": 0, "subject_id": None}
    duration = RECORDING_DURATIONS[index]
    elapsed = (now - step_started).total_seconds()
    label, instruction = _STEP_DEFINITIONS[index]
    return {
        "active": True,
        "session_id": recording.id,
        "label": label,
        "step": index + 1,
        "step_count": len(_STEP_DEFINITIONS),
        "instruction": instruction,
        "seconds_remaining": max(0, math.ceil(duration - elapsed)),
        "subject_id": recording.subject_id,
    }


def get_current_recording(user_id):
    with SessionLocal() as db:
        recording = db.scalar(
            select(RecordingSession).where(
                RecordingSession.user_id == user_id,
                RecordingSession.active.is_(True),
            )
        )
        if recording is None:
            return _status(None)
        return _status(recording)


def start_recording(user_id, glasses, lighting, camera_angle):
    now = utc_now()
    with SessionLocal() as db:
        current = db.scalar(
            select(RecordingSession).where(
                RecordingSession.user_id == user_id,
                RecordingSession.active.is_(True),
            )
        )
        if current:
            _advance_protocol(current, now)
        if current and current.active:
            raise ValueError("A recording is already active")
        if current:
            db.commit()

        subject = db.get(RecordingSubject, user_id)
        if subject is None:
            subject = RecordingSubject(user_id=user_id, subject_id=str(uuid.uuid4()))
            db.add(subject)
            db.flush()

        recording = RecordingSession(
            id=str(uuid.uuid4()),
            user_id=user_id,
            subject_id=subject.subject_id,
            glasses="yes" if glasses else "no",
            lighting=lighting,
            camera_angle=camera_angle,
            started_at=now,
            active=True,
            step_index=0,
            current_label="calibration",
            step_started_at=now,
        )
        db.add(recording)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ValueError("A recording is already active") from exc
        return _status(recording, now)


def stop_recording(user_id):
    now = utc_now()
    with SessionLocal() as db:
        recording = db.scalar(
            select(RecordingSession).where(
                RecordingSession.user_id == user_id,
                RecordingSession.active.is_(True),
            )
        )
        if recording is None:
            return _status(None)
        recording.active = False
        recording.stopped_at = now
        db.commit()
        return _status(None)


def set_recording_label(user_id, label):
    now = utc_now()
    with SessionLocal() as db:
        recording = db.scalar(
            select(RecordingSession).where(
                RecordingSession.user_id == user_id,
                RecordingSession.active.is_(True),
            )
        )
        if recording is None:
            raise LookupError("No active recording")
        index = RECORDING_LABELS.index(label)
        recording.step_index = index
        recording.current_label = label
        recording.step_started_at = now
        db.commit()
        return _status(recording, now)


def record_feature_frame(user_id, features, timestamp=None):
    values = [float(value) for value in features]
    if len(values) != 20 or not all(math.isfinite(value) and 0 <= value <= 1 for value in values):
        raise ValueError("Recording feature vector is invalid")
    now = _as_utc(timestamp or utc_now())
    with SessionLocal() as db:
        recording = db.scalar(
            select(RecordingSession).where(
                RecordingSession.user_id == user_id,
                RecordingSession.active.is_(True),
            )
        )
        if recording is None:
            return None
        _advance_protocol(recording, now)
        if not recording.active:
            db.commit()
            return _status(recording, now)
        db.add(RecordingFrame(
            session_id=recording.id,
            timestamp=now,
            label=recording.current_label,
            features=values,
        ))
        _advance_protocol(recording, now)
        db.commit()
        return _status(recording, now)
