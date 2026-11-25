import unittest
import uuid
from datetime import datetime, timezone

from tests import support

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from database import Alert, SessionLocal, User
from main import app
from utils.live_session import get_session, reset_session


ORIGIN = "http://testserver"


def signup(client):
    username = f"test-{uuid.uuid4().hex}@example.test"
    response = client.post(
        "/api/auth/signup",
        headers={"origin": ORIGIN},
        json={"username": username, "password": "test-password-123", "name": "Test User"},
    )
    return username, response


class AppAuthTests(unittest.TestCase):
    def test_app_import_startup_and_health(self):
        with TestClient(app) as client:
            self.assertEqual(client.get("/health").json(), {"status": "ok"})
            self.assertEqual(client.get("/api/health").json(), {"status": "ok", "db": "ok"})

    def test_signup_login_me_logout(self):
        with TestClient(app) as client:
            username, response = signup(client)
            self.assertEqual(response.status_code, 200)
            self.assertIn("access_token", response.headers.get("set-cookie", ""))
            self.assertEqual(client.get("/api/auth/me").json()["username"], username)
            self.assertEqual(
                client.post("/api/auth/logout", headers={"origin": ORIGIN}).status_code,
                204,
            )
            self.assertEqual(client.get("/api/auth/me").status_code, 401)
            login_response = client.post(
                "/api/auth/login",
                headers={"origin": ORIGIN},
                json={"username": username, "password": "test-password-123"},
            )
            self.assertEqual(login_response.status_code, 200)
            self.assertEqual(client.get("/api/auth/me").status_code, 200)

    def test_signup_validation_and_taken_username(self):
        with TestClient(app) as client:
            username, first = signup(client)
            self.assertEqual(first.status_code, 200)
            duplicate = client.post(
                "/api/auth/signup",
                headers={"origin": ORIGIN},
                json={"username": username, "password": "test-password-123"},
            )
            self.assertEqual(duplicate.status_code, 409)
            self.assertEqual(duplicate.json()["detail"], "That username is already taken")
            too_short = client.post(
                "/api/auth/signup",
                headers={"origin": ORIGIN},
                json={"username": "ab", "password": "short"},
            )
            self.assertEqual(too_short.status_code, 422)
            self.assertTrue(any(issue["loc"][-1] == "password" for issue in too_short.json()["detail"]))
            wrong_password = client.post(
                "/api/auth/login",
                headers={"origin": ORIGIN},
                json={"username": username, "password": "wrong-password"},
            )
            self.assertEqual(wrong_password.status_code, 401)
            self.assertEqual(wrong_password.json()["detail"], "Invalid username or password")

    def test_all_protected_http_routes_require_cookie(self):
        routes = [
            ("GET", "/api/auth/me"),
            ("POST", "/api/auth/logout"),
            ("GET", "/api/detection/status"),
            ("POST", "/api/detection/demo/frame", {"frame": 1}),
            ("GET", "/api/cluster/pca"),
            ("GET", "/api/cluster/kmeans"),
            ("GET", "/api/cluster/dbscan"),
            ("GET", "/api/cluster/hierarchical"),
            ("GET", "/api/cluster/validation"),
            ("GET", "/api/cluster/live"),
            ("GET", "/api/cluster/live/validation"),
            ("GET", "/api/metrics/clustering"),
            ("GET", "/api/metrics/detection"),
            ("GET", "/api/metrics/confusion"),
            ("GET", "/api/metrics/roc"),
            ("GET", "/api/metrics/all"),
            ("GET", "/api/metrics/live"),
            ("GET", "/api/metrics/live/roc"),
            ("GET", "/api/metrics/live/timeline"),
            ("POST", "/api/metrics/reset"),
            ("GET", "/api/alerts/history"),
            ("GET", "/api/alerts/stats"),
            ("GET", "/api/alerts/export"),
            ("GET", "/api/recordings/protocol"),
            ("GET", "/api/recordings/current"),
            ("POST", "/api/recordings/start", {"consent_accepted": True, "glasses": False, "lighting": "normal", "camera_angle": "frontal"}),
            ("POST", "/api/recordings/stop"),
            ("POST", "/api/recordings/current/label", {"label": "normal"}),
            ("GET", "/api/recordings"),
            ("GET", "/api/recordings/missing/export"),
            ("DELETE", "/api/recordings/missing"),
        ]
        with TestClient(app) as client:
            for entry in routes:
                method, path = entry[:2]
                body = entry[2] if len(entry) == 3 else None
                kwargs = {"headers": {"origin": ORIGIN}} if method in {"POST", "DELETE"} else {}
                if body is not None:
                    kwargs["json"] = body
                response = client.request(method, path, **kwargs)
                self.assertEqual(response.status_code, 401, f"{method} {path}: {response.status_code}")

    def test_alerts_and_live_state_are_per_user(self):
        with TestClient(app) as first, TestClient(app) as second:
            first_name, first_response = signup(first)
            second_name, second_response = signup(second)
            self.assertEqual(first_response.status_code, 200)
            self.assertEqual(second_response.status_code, 200)
            with SessionLocal() as db:
                first_user_id = db.query(User).filter_by(username=first_name).one().id
                second_user_id = db.query(User).filter_by(username=second_name).one().id
                db.add(Alert(
                    user_id=first_user_id,
                    timestamp=datetime.now(timezone.utc),
                    peak_severity=0.8,
                    frame=4,
                    state="ended",
                    ae_error=0.2,
                    if_score=-0.1,
                    lof=0.3,
                    confidence=0.8,
                    models=["eye_closure"],
                    votes=1,
                    model_alerts={},
                    live_signals={"eye_closure": True},
                ))
                db.commit()
            reset_session(first_user_id)
            reset_session(second_user_id)
            first.post("/api/detection/demo/frame", headers={"origin": ORIGIN}, json={"frame": 2})
            self.assertEqual(first.get("/api/alerts/history").json()["total"], 1)
            self.assertEqual(second.get("/api/alerts/history").json()["total"], 0)
            self.assertEqual(first.get("/api/metrics/live").json()["total_frames"], 1)
            self.assertEqual(second.get("/api/metrics/live").json()["total_frames"], 0)

    def test_origin_rejection_http_and_websocket_auth(self):
        with TestClient(app) as client:
            rejected = client.post(
                "/api/auth/signup",
                headers={"origin": "https://untrusted.invalid"},
                json={"username": f"x-{uuid.uuid4().hex}@example.test", "password": "test-password-123"},
            )
            self.assertEqual(rejected.status_code, 403)
            self.assertEqual(rejected.json()["detail"], "Origin not allowed")
            with self.assertRaises(WebSocketDisconnect) as missing_cookie:
                with client.websocket_connect("/api/detection/ws", headers={"origin": ORIGIN}):
                    pass
            self.assertEqual(missing_cookie.exception.code, 1008)
            with self.assertRaises(WebSocketDisconnect) as invalid_cookie:
                with client.websocket_connect(
                    "/api/detection/ws",
                    headers={"origin": ORIGIN, "cookie": "access_token=not-a-valid-jwt"},
                ):
                    pass
            self.assertEqual(invalid_cookie.exception.code, 1008)
            with self.assertRaises(WebSocketDisconnect) as bad_origin:
                with client.websocket_connect(
                    "/api/detection/ws",
                    headers={"origin": "https://untrusted.invalid", "cookie": "access_token=invalid"},
                ):
                    pass
            self.assertEqual(bad_origin.exception.code, 1008)
            self.assertEqual(bad_origin.exception.reason, "Origin not allowed")


if __name__ == "__main__":
    unittest.main()
