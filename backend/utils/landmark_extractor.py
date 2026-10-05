import cv2
import mediapipe as mp
import numpy as np
from typing import List, Optional


class LandmarkExtractor:
    """Convert MediaPipe face landmarks into the 20 features used by training."""

    def __init__(self):
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    @staticmethod
    def _distance(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.linalg.norm(a - b))

    @staticmethod
    def _unit(value: float) -> float:
        return float(np.clip(value, 0.0, 1.0))

    def extract(self, frame: np.ndarray) -> Optional[np.ndarray]:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self.face_mesh.process(rgb)
        if not result.multi_face_landmarks:
            return None

        landmarks = result.multi_face_landmarks[0].landmark
        height, width = frame.shape[:2]
        points = np.asarray([(point.x * width, point.y * height) for point in landmarks], dtype=np.float32)
        if len(points) < 468:
            return None

        # Eye Aspect Ratios use the same corner and lid landmarks at both eyes.
        left_width = max(self._distance(points[33], points[133]), 1e-6)
        right_width = max(self._distance(points[362], points[263]), 1e-6)
        left_ear = (self._distance(points[160], points[144]) + self._distance(points[158], points[153])) / (2 * left_width)
        right_ear = (self._distance(points[385], points[380]) + self._distance(points[387], points[373])) / (2 * right_width)
        avg_ear = (left_ear + right_ear) / 2

        mouth_width = max(self._distance(points[78], points[308]), 1e-6)
        mar = self._distance(points[13], points[14]) / mouth_width
        eye_mid = (points[33] + points[263]) / 2
        nose = points[1]
        chin = points[152]
        face_height = max(float(chin[1] - eye_mid[1]), 1e-6)
        eye_span = max(float(points[263][0] - points[33][0]), 1e-6)

        # Refined Face Mesh includes iris centers (468 and 473).
        left_iris = points[468] if len(points) > 468 else (points[33] + points[133]) / 2
        right_iris = points[473] if len(points) > 473 else (points[362] + points[263]) / 2
        left_brow_gap = self._distance(points[105], points[159]) / left_width
        right_brow_gap = self._distance(points[334], points[386]) / right_width
        eye_line_angle = np.arctan2(float(points[263][1] - points[33][1]), eye_span)
        nose_center_offset = (float(nose[0] - eye_mid[0])) / eye_span
        nose_y_ratio = (float(nose[1]) - float(eye_mid[1])) / face_height

        # Keep feature order aligned with backend/data/generate_dataset.py.
        features = np.asarray([
            left_ear,
            right_ear,
            avg_ear,
            mar,
            1.0 - min(left_brow_gap * 0.5, 1.0),
            1.0 - min(right_brow_gap * 0.5, 1.0),
            abs(float(eye_line_angle)),
            abs(nose_center_offset),
            nose_y_ratio,
            0.1 + 0.8 * self._unit((float(left_iris[0]) - float(points[33][0])) / eye_span),
            self._unit((float(left_iris[1]) - float(eye_mid[1])) / face_height + 0.48),
            0.1 + 0.8 * self._unit((float(right_iris[0]) - float(points[33][0])) / eye_span),
            self._unit((float(right_iris[1]) - float(eye_mid[1])) / face_height + 0.48),
            mar,
            left_ear * 2.5,
            right_ear * 2.5,
            (float(points[78][0]) - float(points[33][0])) / eye_span,
            (float(points[308][0]) - float(points[33][0])) / eye_span,
            (1.0 - min((left_brow_gap + right_brow_gap) * 0.25, 1.0)),
            nose_y_ratio,
        ], dtype=np.float32)
        return np.clip(features, 0.0, 1.0)

    def extract_from_video(self, path: str) -> List[np.ndarray]:
        capture = cv2.VideoCapture(path)
        features = []
        while capture.isOpened():
            ok, frame = capture.read()
            if not ok:
                break
            landmarks = self.extract(frame)
            if landmarks is not None:
                features.append(landmarks)
        capture.release()
        return features
