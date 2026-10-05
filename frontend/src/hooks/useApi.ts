import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllMetrics,
  getAlertHistory,
  getAlertStats,
  getValidation,
  getLiveClusters,
  getKMeans,
  getPCA,
  DetectionWebSocket,
  AllMetrics,
  AlertHistoryResponse,
  AlertStats,
  ValidationResponse,
  KMeansResponse,
  PCAResponse,
  MockFrameResponse,
} from "../lib/api";

// --- useMetrics ---

export const useMetrics = () => {
  const [data, setData] = useState<AllMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllMetrics();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { data, loading, error, refetch: fetchMetrics };
};

// --- useAlerts ---

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<AlertHistoryResponse | null>(null);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlertsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsData, statsData] = await Promise.all([
        getAlertHistory(),
        getAlertStats(),
      ]);
      setAlerts(alertsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlertsData();
    const interval = window.setInterval(fetchAlertsData, 3000);
    return () => window.clearInterval(interval);
  }, [fetchAlertsData]);

  return { alerts, stats, loading, error, refetch: fetchAlertsData };
};

// --- useClustering ---

export const useClustering = () => {
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [kmeans, setKmeans] = useState<KMeansResponse | null>(null);
  const [pca, setPca] = useState<PCAResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchClusteringData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [validationData, kmeansData, pcaData] = await Promise.all([
        getValidation(),
        getKMeans(),
        getPCA(),
      ]);
      setValidation(validationData);
      setKmeans(kmeansData);
      setPca(pcaData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClusteringData();
  }, [fetchClusteringData]);

  return { validation, kmeans, pca, loading, error };
};

export const useLiveClusters = () => {
  const [points, setPoints] = useState<Array<{ x: number; y: number; label: number; density_label?: number }>>([]);
  useEffect(() => {
    let active = true;
    const fetchPoints = async () => {
      try {
        const result = await getLiveClusters();
        if (active) setPoints(result.points);
      } catch (err) {
        console.error("Failed to fetch live clustering points", err);
      }
    };
    fetchPoints();
    const interval = window.setInterval(fetchPoints, 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  return points;
};

// --- useDetection ---

export const useDetection = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentState, setCurrentState] = useState<"ALERT" | "DROWSY" | "NORMAL">("NORMAL");
  const [aeError, setAeError] = useState<number>(0);
  const [ifScore, setIfScore] = useState<number>(0);
  const [lofScore, setLofScore] = useState<number>(0);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [confidence, setConfidence] = useState(0);
  const [modelAlerts, setModelAlerts] = useState({ autoencoder: false, isolation_forest: false, lof: false });
  const [faceDetected, setFaceDetected] = useState(false);
  const mounted = useRef(false);
  const wasAlerting = useRef(false);
  const reconnectTimer = useRef<number | undefined>(undefined);

  const [ws] = useState(() => new DetectionWebSocket());

  const connectWs = useCallback(() => {
    ws.connect(
      (data: MockFrameResponse) => {
        setAeError(data.ae_error);
        setIfScore(data.if_score);
        setLofScore(data.lof_score);
        setFrameCount(data.frame);
        setFaceDetected(data.face_detected ?? false);
        setConfidence(data.confidence ?? 0);
        setModelAlerts(data.model_alerts ?? { autoencoder: false, isolation_forest: false, lof: false });
        
        if (data.is_drowsy) {
          setCurrentState("DROWSY");
          if (!wasAlerting.current) setAlertCount((prev) => prev + 1);
        } else {
          setCurrentState("NORMAL");
        }
        wasAlerting.current = data.is_drowsy;
      },
      (err) => {
        console.error("Detection WS error", err);
      },
      () => {
        setIsConnected(false);
        if (mounted.current) reconnectTimer.current = window.setTimeout(() => connectWs(), 3000);
      },
      () => setIsConnected(true)
    );
  }, [ws]);

  useEffect(() => {
    mounted.current = true;
    connectWs();
    return () => {
      mounted.current = false;
      window.clearTimeout(reconnectTimer.current);
      ws.disconnect();
    };
  }, [connectWs, ws]);

  const sendFrame = useCallback((data: string) => {
    // Send string directly if it's already a string, or stringify if object
    ws.send(data);
  }, [ws]);

  return {
    isConnected,
    currentState,
    aeError,
    ifScore,
    lofScore,
    frameCount,
    alertCount,
    confidence,
    modelAlerts,
    faceDetected,
    reconnect: connectWs,
    sendFrame
  };
};
