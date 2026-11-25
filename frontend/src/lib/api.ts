// Vercel routes /api on the same deployment origin to the backend service.
// Relative URLs also keep local frontend/backend proxy setups configurable.
export const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// --- API Helpers ---

const getHeaders = (): HeadersInit => {
  return {
    "Content-Type": "application/json",
  };
};

const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetch(input, { credentials: "include", ...init });

const formatValidationDetail = (detail: unknown): string | null => {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return null;
  const messages = detail.map((issue: unknown) => {
    if (!issue || typeof issue !== "object") return null;
    const item = issue as { loc?: unknown[]; msg?: unknown; type?: string; ctx?: { min_length?: number } };
    const field = String(item.loc?.at(-1) || "").toLowerCase();
    const label = field === "password" ? "Password" : field === "username" ? "Username" : field ? field[0].toUpperCase() + field.slice(1) : "Input";
    if (field === "password" && item.type?.includes("too_short")) return `Password must be at least ${item.ctx?.min_length || 8} characters.`;
    if (field === "username" && item.type?.includes("too_short")) return `Username must be at least ${item.ctx?.min_length || 3} characters.`;
    if (item.type === "missing") return `${label} is required.`;
    if (typeof item.msg === "string") return `${label}: ${item.msg.replace(/^Value error,\s*/i, "")}.`;
    return null;
  }).filter((message): message is string => Boolean(message));
  return messages.length ? [...new Set(messages)].join(" ") : null;
};

const apiError = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    return "The server did not respond correctly. Check the deployment routing.";
  }
  try {
    const errorData = await response.clone().json();
    if (response.status === 401) return "Invalid username or password";
    if (response.status === 422) return formatValidationDetail(errorData.detail) || "Check the fields and try again.";
    if (response.status === 403) {
      return `${formatValidationDetail(errorData.detail) || "Request blocked"}. Check that the server is running and the site origin is configured.`;
    }
    if (response.status >= 500) return "The server could not complete the request. Check that the server is running.";
    return formatValidationDetail(errorData.detail) || (typeof errorData.message === "string" ? errorData.message : "Request could not be completed. Try again.");
  } catch {
    if (response.status === 401) return "Invalid username or password";
    if (response.status === 403) return "Request blocked. Check that the server is running and the site origin is configured.";
    if (response.status >= 500) return "The server could not complete the request. Check that the server is running.";
    return "Request could not be completed. Try again.";
  }
};

const handleResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("The server did not respond correctly. Check the deployment routing.");
  }
  if (!response.ok) {
    const errorMessage = await apiError(response);
    throw new Error(errorMessage);
  }
  if (response.status === 204) return undefined;
  return response.json();
};

// --- Auth Functions ---

export interface AuthResponse {
  username: string;
  name?: string;
}

export const login = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(response);
};

export const signup = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(response);
};

export const getCurrentUser = async (): Promise<AuthResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/auth/me`);
  return handleResponse(response);
};

export const logout = async (): Promise<void> => {
  const response = await apiFetch(`${BASE_URL}/api/auth/logout`, { method: "POST" });
  if (!response.ok) throw new Error(await apiError(response));
};

// --- Metrics Functions ---

export interface ClusteringMetrics {
  silhouette: number;
  davies_bouldin: number;
  wcss: number;
  optimal_k: number;
  wcss_list: number[];
}

export interface DetectionMetrics {
  f1_score: number | null;
  roc_auc: number | null;
  precision: number | null;
  recall: number | null;
  accuracy: number | null;
}

export interface ConfusionMatrix {
  true_positive: number;
  false_positive: number;
  false_negative: number;
  true_negative: number;
}

export interface RocCurve {
  fpr: number[];
  tpr: number[];
  auc: number;
}

export interface AllMetrics {
  clustering: ClusteringMetrics;
  detection: DetectionMetrics;
  confusion: ConfusionMatrix;
  roc: RocCurve;
  live?: LiveMetrics;
}

export interface LiveMetrics extends DetectionMetrics {
  confusion?: ConfusionMatrix | { tp: number; fp: number; fn: number; tn: number } | null;
  source: "live" | "synthetic";
  metric_kind?: "live_stream_summary" | "synthetic_labeled_demo";
  frames_needed: number;
  live_frames: number;
  total_frames?: number;
  drowsy_frames?: number;
  alert_frames?: number;
  avg_ae_error?: number | null;
  avg_if_score?: number | null;
  avg_lof_score?: number | null;
  eye_closure_frames?: number;
  yawn_frames?: number;
  model_consensus_frames?: number;
}

export interface LiveRocCurve {
  fpr: number[];
  tpr: number[];
  auc: number | null;
  source: "live";
  metric_kind?: "heuristic_estimate";
}

export interface LiveTimeline {
  timeline: Array<{ frame: number; error: number; threshold: number; is_drowsy: boolean }>;
  threshold: number | null;
}

export const getAllMetrics = async (): Promise<AllMetrics> => {
  const response = await apiFetch(`${BASE_URL}/api/metrics/all`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveMetrics = async (): Promise<LiveMetrics> => {
  const response = await apiFetch(`${BASE_URL}/api/metrics/live`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveRoc = async (): Promise<LiveRocCurve> => {
  const response = await apiFetch(`${BASE_URL}/api/metrics/live/roc`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveTimeline = async (): Promise<LiveTimeline> => {
  const response = await apiFetch(`${BASE_URL}/api/metrics/live/timeline`, { headers: getHeaders() });
  return handleResponse(response);
};

export const resetLiveSession = async (): Promise<{ status: string; message: string }> => {
  const response = await apiFetch(`${BASE_URL}/api/metrics/reset`, { method: "POST", headers: getHeaders() });
  return handleResponse(response);
};

export const postSyntheticDemoFrame = async (frame: number): Promise<DetectionFrameResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/detection/demo/frame`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ frame }),
  });
  return handleResponse(response);
};

export const getClusteringMetrics = async (): Promise<ClusteringMetrics> => {
  const response = await apiFetch(`${BASE_URL}/api/metrics/clustering`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getDetectionMetrics = async (): Promise<DetectionMetrics> => {
  const response = await apiFetch(`${BASE_URL}/api/metrics/detection`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getConfusionMatrix = async (): Promise<ConfusionMatrix> => {
  const response = await apiFetch(`${BASE_URL}/api/metrics/confusion`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getRocCurve = async (): Promise<RocCurve> => {
  const response = await apiFetch(`${BASE_URL}/api/metrics/roc`, { headers: getHeaders() });
  return handleResponse(response);
};

// --- Alerts Functions ---

export interface Alert {
  id: number;
  timestamp: string;
  end_timestamp?: string | null;
  peak_severity?: number;
  state: string;
  ae_error: number;
  if_score: number;
  lof: number;
  confidence: number;
  models: string[];
  frame?: number;
}

export interface AlertHistoryResponse {
  total: number;
  alerts: Alert[];
}

export interface AlertStats {
  total_frames: number;
  alert_frames: number;
  drowsy_alerts: number;
  yawn_alerts: number;
  session_duration: string;
  alert_rate: string;
}

export const getAlertHistory = async (): Promise<AlertHistoryResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/alerts/history`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getAlertStats = async (): Promise<AlertStats> => {
  const response = await apiFetch(`${BASE_URL}/api/alerts/stats`, { headers: getHeaders() });
  return handleResponse(response);
};

export const exportAlerts = async (): Promise<string> => {
  const response = await apiFetch(`${BASE_URL}/api/alerts/export`, { headers: getHeaders() });
  if ((response.headers.get("content-type") || "").includes("text/html")) {
    throw new Error("The server did not respond correctly. Check the deployment routing.");
  }
  if (!response.ok) throw new Error(await apiError(response));
  return response.text();
};

// --- Clustering Functions ---

export interface KMeansResponse {
  elbow: number[];
  optimal_k: number;
  silhouette_score: number;
  davies_bouldin_score: number;
  wcss: number;
  labels: number[];
}

export interface DBSCANResponse {
  labels: number[];
  noise_count: number;
  core_count: number;
  n_clusters: number;
}

export interface Point2D {
  x: number;
  y: number;
  label: number;
  density_label?: number;
}

export interface LiveClusterResponse {
  points: Point2D[];
  count: number;
  source?: "live";
}

export interface LiveClusterValidation {
  silhouette_score: number | null;
  davies_bouldin_score: number | null;
  count: number;
  source: "live";
}

export interface PCAResponse {
  points: Point2D[];
  variance_explained: number[];
}

export interface HierarchicalResponse {
  labels: number[];
  silhouette_score: number;
  davies_bouldin_score: number;
}

export interface ValidationResponse {
  silhouette_score: number;
  davies_bouldin_score: number;
  wcss: number;
  wcss_list: number[];
  optimal_k: number;
}

export const getKMeans = async (): Promise<KMeansResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/cluster/kmeans`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getDBSCAN = async (): Promise<DBSCANResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/cluster/dbscan`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getPCA = async (): Promise<PCAResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/cluster/pca`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveClusters = async (): Promise<LiveClusterResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/cluster/live`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveClusterValidation = async (): Promise<LiveClusterValidation> => {
  const response = await apiFetch(`${BASE_URL}/api/cluster/live/validation`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getHierarchical = async (): Promise<HierarchicalResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/cluster/hierarchical`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getValidation = async (): Promise<ValidationResponse> => {
  const response = await apiFetch(`${BASE_URL}/api/cluster/validation`, { headers: getHeaders() });
  return handleResponse(response);
};

// --- Detection Functions ---

export interface DetectionStatus {
  status: string;
  websocket_url: string;
}

export interface DetectionFrameResponse {
  frame: number;
  valid_face_frames?: number;
  ae_error: number;
  ae_threshold?: number;
  if_score: number;
  lof_score: number;
  is_drowsy: boolean;
  votes: number;
  face_detected?: boolean;
  confidence?: number;
  model_alerts?: { autoencoder: boolean; isolation_forest: boolean; lof: boolean };
  live_signals?: { eye_closure: boolean; yawn: boolean; model_consensus: boolean };
  session_frames?: number;
  session_drowsy?: number;
  live_metrics?: LiveMetrics;
  features?: number[];
  models?: string[];
  model_available?: boolean;
  processing_error?: string;
  phase?: "calibrating" | "active";
  progress?: number;
  source?: "camera" | "synthetic";
  synthetic_ground_truth?: boolean;
  alert_event?: boolean;
  recording_protocol?: RecordingStatus | null;
  episode_event?: {
    action: "started" | "ended";
    id: number | null;
    timestamp: string;
    end_timestamp: string | null;
    peak_severity: number;
    alert_event: boolean;
  };
}

export interface RecordingStatus {
  active: boolean;
  session_id: string | null;
  subject_id: string | null;
  label: string | null;
  step: number | null;
  step_count?: number;
  instruction: string | null;
  seconds_remaining: number;
}

export interface RecordingProtocol {
  consent_notice: string;
  labels: string[];
  steps: Array<{ label: string; instruction: string; duration_seconds: number }>;
  lighting_options: string[];
  camera_angle_options: string[];
}

export const getRecordingProtocol = async (): Promise<RecordingProtocol> => {
  const response = await apiFetch(`${BASE_URL}/api/recordings/protocol`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getCurrentRecording = async (): Promise<RecordingStatus> => {
  const response = await apiFetch(`${BASE_URL}/api/recordings/current`, { headers: getHeaders() });
  return handleResponse(response);
};

export const startRecording = async (input: {
  consent_accepted: boolean;
  glasses: boolean;
  lighting: string;
  camera_angle: string;
}): Promise<RecordingStatus> => {
  const response = await apiFetch(`${BASE_URL}/api/recordings/start`, {
    method: "POST", headers: getHeaders(), body: JSON.stringify(input),
  });
  return handleResponse(response);
};

export const stopRecording = async (): Promise<RecordingStatus> => {
  const response = await apiFetch(`${BASE_URL}/api/recordings/stop`, { method: "POST", headers: getHeaders() });
  return handleResponse(response);
};

export const setCurrentRecordingLabel = async (label: string): Promise<RecordingStatus> => {
  const response = await apiFetch(`${BASE_URL}/api/recordings/current/label`, {
    method: "POST", headers: getHeaders(), body: JSON.stringify({ label }),
  });
  return handleResponse(response);
};

export const listRecordings = async () => {
  const response = await apiFetch(`${BASE_URL}/api/recordings`, { headers: getHeaders() });
  return handleResponse(response);
};

export const exportRecording = async (sessionId: string): Promise<Blob> => {
  const response = await apiFetch(`${BASE_URL}/api/recordings/${encodeURIComponent(sessionId)}/export`);
  if ((response.headers.get("content-type") || "").includes("text/html")) {
    throw new Error("The server did not respond correctly. Check the deployment routing.");
  }
  if (!response.ok) throw new Error(await apiError(response));
  return response.blob();
};

export const deleteRecording = async (sessionId: string): Promise<void> => {
  const response = await apiFetch(`${BASE_URL}/api/recordings/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await apiError(response));
};

export const getDetectionStatus = async (): Promise<DetectionStatus> => {
  const response = await apiFetch(`${BASE_URL}/api/detection/status`, { headers: getHeaders() });
  return handleResponse(response);
};

// --- WebSocket Class ---

export class DetectionWebSocket {
  private ws: WebSocket | null = null;

  connect(
    onMessage: (data: DetectionFrameResponse) => void,
    onError: (error: Event) => void,
    onClose: (event: CloseEvent) => void,
    onOpen?: () => void
  ): void {
    if (this.ws) {
      this.disconnect();
    }
    
    // The same-origin Vercel route sends this handshake to the backend service.
    const apiBase = BASE_URL || window.location.origin;
    const defaultWsBase = apiBase.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
    const wsBase = (import.meta.env.VITE_WS_URL || defaultWsBase).replace(/\/$/, "");
    const wsUrl = `${wsBase}/api/detection/ws`;
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => onOpen?.();

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error("Error parsing websocket message", err);
      }
    };

    this.ws.onerror = (error) => {
      onError(error);
    };

    this.ws.onclose = (event) => {
      onClose(event);
      this.ws = null;
    };
  }

  send(data: object | string): boolean {
    if (!this.isConnected()) return false;
    try {
      this.ws!.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Detection WS frame send failed', error);
      return false;
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
