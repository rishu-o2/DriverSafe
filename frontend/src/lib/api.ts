export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

// --- Token Storage Helpers ---

export const saveToken = (token: string): void => {
  localStorage.setItem("access_token", token);
};

export const getToken = (): string | null => {
  return localStorage.getItem("access_token");
};

export const removeToken = (): void => {
  localStorage.removeItem("access_token");
};

export const isLoggedIn = (): boolean => {
  return !!getToken();
};

// --- API Helpers ---

const getHeaders = (): HeadersInit => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    let errorMessage = "An error occurred";
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // Ignored
    }
    throw new Error(errorMessage);
  }
  return response.json();
};

// --- Auth Functions ---

export interface AuthResponse {
  access_token: string;
  token_type: string;
  name?: string;
  email?: string;
}

export const login = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(response);
};

export const signup = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  const response = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password, name }), // sending email as username for backend
  });
  return handleResponse(response);
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
  source: "live";
  metric_kind?: "live_stream_summary";
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
  const response = await fetch(`${BASE_URL}/api/metrics/all`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveMetrics = async (): Promise<LiveMetrics> => {
  const response = await fetch(`${BASE_URL}/api/metrics/live`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveRoc = async (): Promise<LiveRocCurve> => {
  const response = await fetch(`${BASE_URL}/api/metrics/live/roc`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveTimeline = async (): Promise<LiveTimeline> => {
  const response = await fetch(`${BASE_URL}/api/metrics/live/timeline`, { headers: getHeaders() });
  return handleResponse(response);
};

export const resetLiveSession = async (): Promise<{ status: string; message: string }> => {
  const response = await fetch(`${BASE_URL}/api/metrics/reset`, { method: "POST", headers: getHeaders() });
  return handleResponse(response);
};

export const getClusteringMetrics = async (): Promise<ClusteringMetrics> => {
  const response = await fetch(`${BASE_URL}/api/metrics/clustering`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getDetectionMetrics = async (): Promise<DetectionMetrics> => {
  const response = await fetch(`${BASE_URL}/api/metrics/detection`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getConfusionMatrix = async (): Promise<ConfusionMatrix> => {
  const response = await fetch(`${BASE_URL}/api/metrics/confusion`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getRocCurve = async (): Promise<RocCurve> => {
  const response = await fetch(`${BASE_URL}/api/metrics/roc`, { headers: getHeaders() });
  return handleResponse(response);
};

// --- Alerts Functions ---

export interface Alert {
  id: number;
  timestamp: string;
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
  const response = await fetch(`${BASE_URL}/api/alerts/history`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getAlertStats = async (): Promise<AlertStats> => {
  const response = await fetch(`${BASE_URL}/api/alerts/stats`, { headers: getHeaders() });
  return handleResponse(response);
};

export const exportAlerts = async (): Promise<string> => {
  const response = await fetch(`${BASE_URL}/api/alerts/export`, { headers: getHeaders() });
  if (!response.ok) throw new Error("Failed to export alerts");
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
  const response = await fetch(`${BASE_URL}/api/cluster/kmeans`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getDBSCAN = async (): Promise<DBSCANResponse> => {
  const response = await fetch(`${BASE_URL}/api/cluster/dbscan`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getPCA = async (): Promise<PCAResponse> => {
  const response = await fetch(`${BASE_URL}/api/cluster/pca`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveClusters = async (): Promise<LiveClusterResponse> => {
  const response = await fetch(`${BASE_URL}/api/cluster/live`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getLiveClusterValidation = async (): Promise<LiveClusterValidation> => {
  const response = await fetch(`${BASE_URL}/api/cluster/live/validation`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getHierarchical = async (): Promise<HierarchicalResponse> => {
  const response = await fetch(`${BASE_URL}/api/cluster/hierarchical`, { headers: getHeaders() });
  return handleResponse(response);
};

export const getValidation = async (): Promise<ValidationResponse> => {
  const response = await fetch(`${BASE_URL}/api/cluster/validation`, { headers: getHeaders() });
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
}

export const getDetectionStatus = async (): Promise<DetectionStatus> => {
  const response = await fetch(`${BASE_URL}/api/detection/status`, { headers: getHeaders() });
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
    
    // Convert http(s) URL to ws(s) if VITE_WS_URL wasn't provided properly
    const wsUrl = `${WS_URL}/api/detection/ws`;
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
