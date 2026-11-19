"""Authenticated recording-session API. No video or image data is accepted."""

import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from database import RecordingFrame, RecordingSession, SessionLocal, User
from routers.auth import get_current_user
from utils.recording import (
    RECORDING_DURATIONS,
    RECORDING_LABELS,
    _STEP_DEFINITIONS,
    get_current_recording,
    set_recording_label,
    start_recording,
    stop_recording,
)


router = APIRouter()
CONSENT_NOTICE = (
    "Recording stores only derived facial feature numbers and the selected "
    "label and conditions; it never stores camera video or images. Take part "
    "voluntarily, remain seated and parked, and do not induce fatigue or "
    "perform these actions while driving. You can export or delete your own recordings."
)


class StartRecordingRequest(BaseModel):
    consent_accepted: bool
    glasses: bool
    lighting: Literal["bright", "normal", "dim", "mixed", "other"]
    camera_angle: Literal["frontal", "slight_left", "slight_right", "above", "below", "other"]


class SetLabelRequest(BaseModel):
    label: Literal["calibration", "normal", "drowsy_eyes", "drowsy_yawn", "drowsy_nod"]


@router.get("/protocol")
def get_protocol(user: User = Depends(get_current_user)):
    return {
        "consent_notice": CONSENT_NOTICE,
        "labels": list(RECORDING_LABELS),
        "steps": [
            {"label": label, "instruction": instruction, "duration_seconds": duration}
            for (label, instruction), duration in zip(_STEP_DEFINITIONS, RECORDING_DURATIONS)
        ],
        "lighting_options": ["bright", "normal", "dim", "mixed", "other"],
        "camera_angle_options": ["frontal", "slight_left", "slight_right", "above", "below", "other"],
    }


@router.get("/current")
def current_recording(user: User = Depends(get_current_user)):
    return get_current_recording(user.id)


@router.post("/start")
def begin_recording(body: StartRecordingRequest, user: User = Depends(get_current_user)):
    if not body.consent_accepted:
        raise HTTPException(status_code=400, detail="Consent is required before recording")
    try:
        return start_recording(user.id, body.glasses, body.lighting, body.camera_angle)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/stop")
def end_recording(user: User = Depends(get_current_user)):
    return stop_recording(user.id)


@router.post("/current/label")
def update_label(body: SetLabelRequest, user: User = Depends(get_current_user)):
    try:
        return set_recording_label(user.id, body.label)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("")
def list_recordings(user: User = Depends(get_current_user), limit: int = 100):
    limit = max(1, min(limit, 500))
    with SessionLocal() as db:
        frame_counts = dict(db.execute(
            select(RecordingFrame.session_id, func.count(RecordingFrame.id))
            .join(RecordingSession, RecordingFrame.session_id == RecordingSession.id)
            .where(RecordingSession.user_id == user.id)
            .group_by(RecordingFrame.session_id)
        ).all())
        recordings = db.scalars(
            select(RecordingSession)
            .where(RecordingSession.user_id == user.id)
            .order_by(RecordingSession.started_at.desc())
            .limit(limit)
        ).all()
        return [{
            "session_id": recording.id,
            "subject_id": recording.subject_id,
            "started_at": recording.started_at.isoformat(),
            "stopped_at": recording.stopped_at.isoformat() if recording.stopped_at else None,
            "active": recording.active,
            "frames": frame_counts.get(recording.id, 0),
            "metadata": {
                "glasses": recording.glasses,
                "lighting": recording.lighting,
                "camera_angle": recording.camera_angle,
            },
        } for recording in recordings]


@router.get("/{session_id}/export")
def export_recording(session_id: str, user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        recording = db.scalar(select(RecordingSession).where(
            RecordingSession.id == session_id,
            RecordingSession.user_id == user.id,
        ))
        if recording is None:
            raise HTTPException(status_code=404, detail="Recording not found")
        metadata = {
            "session_id": recording.id,
            "subject_id": recording.subject_id,
            "glasses": recording.glasses,
            "lighting": recording.lighting,
            "camera_angle": recording.camera_angle,
        }

    def iter_jsonl():
        with SessionLocal() as db:
            frames = db.scalars(
                select(RecordingFrame)
                .where(RecordingFrame.session_id == session_id)
                .order_by(RecordingFrame.timestamp, RecordingFrame.id)
                .execution_options(yield_per=500)
            )
            for frame in frames:
                row = {
                    **metadata,
                    "timestamp": frame.timestamp.isoformat(),
                    "label": frame.label,
                    "features": frame.features,
                }
                yield json.dumps(row, separators=(",", ":")) + "\n"

    return StreamingResponse(
        iter_jsonl(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="recording-{session_id}.jsonl"'},
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recording(session_id: str, user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        recording = db.scalar(select(RecordingSession).where(
            RecordingSession.id == session_id,
            RecordingSession.user_id == user.id,
        ))
        if recording is None:
            raise HTTPException(status_code=404, detail="Recording not found")
        db.execute(delete(RecordingFrame).where(RecordingFrame.session_id == session_id))
        db.delete(recording)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
