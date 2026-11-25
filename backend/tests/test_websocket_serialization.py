import unittest
import uuid
from unittest.mock import patch

from tests import support

from fastapi.testclient import TestClient

from main import app
from database import SessionLocal, User
from routers import detection
from utils.live_session import reset_session


class WebSocketSerializationTests(unittest.TestCase):
    def test_synthetic_drowsy_episode_frames_are_returned(self):
        with TestClient(app) as client:
            username = f"ws-{uuid.uuid4().hex}@example.test"
            response = client.post(
                "/api/auth/signup",
                headers={"origin": "http://testserver"},
                json={"username": username, "password": "test-password-123"},
            )
            self.assertEqual(response.status_code, 200)
            with SessionLocal() as db:
                user_id = db.query(User).filter_by(username=username).one().id
            reset_session(user_id)

            def deterministic_detection(frame, features, tracker, baseline=None):
                return {
                    "frame": frame,
                    "ae_error": 0.0,
                    "if_score": 0.0,
                    "lof_score": 0.0,
                    "is_drowsy": frame >= 61,
                    "votes": 0,
                    "confidence": 1.0 if frame >= 61 else 0.0,
                    "face_detected": True,
                    "live_signals": {
                        "eye_closure": frame >= 61,
                        "yawn": False,
                        "model_consensus": False,
                    },
                }

            with patch.object(detection, "process_features", deterministic_detection):
                with client.websocket_connect(
                    "/api/detection/ws", headers={"origin": "http://testserver"}
                ) as websocket:
                    results = []
                    for _ in range(65):
                        websocket.send_json({"synthetic": True})
                        results.append(websocket.receive_json())

        self.assertEqual(len(results), 65)
        self.assertEqual([row["frame"] for row in results], list(range(1, 66)))
        self.assertTrue(all(row["face_detected"] for row in results))
        self.assertTrue(all(row["is_drowsy"] for row in results if row["frame"] >= 61))
        self.assertTrue(all("processing_error" not in row for row in results))
        self.assertTrue(all("episode_event" in row for row in results if row["frame"] == 61))
        self.assertIsInstance(results[60]["episode_event"]["timestamp"], str)
        history = client.get("/api/alerts/history")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()["total"], 1)


if __name__ == "__main__":
    unittest.main()
