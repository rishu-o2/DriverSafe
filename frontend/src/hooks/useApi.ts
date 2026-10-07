import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllMetrics,
  getAlertHistory,
  getAlertStats,
  getValidation,
  getLiveClusters,
  getKMeans,
  getPCA,
  getLiveMetrics,
  getLiveRoc,
  getLiveTimeline,
  getLiveClusterValidation,
  DetectionWebSocket,
  AllMetrics,
  AlertHistoryResponse,
  AlertStats,
  ValidationResponse,
  KMeansResponse,
  PCAResponse,
  MockFrameResponse,
  LiveMetrics,
  LiveTimeline,
  LiveRocCurve,
  LiveClusterValidation,
} from "../lib/api";

// --- useMetrics ---

export const useMetrics = () => {
  const [data, setData] = useState<AllMetrics | null>(null);
  const [liveData, setLiveData] = useState<LiveMetrics | null>(null);
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

  useEffect(() => {
    let active = true;
    const fetchLive = async () => {
      try {
        const result = await getLiveMetrics();
        if (active) setLiveData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    fetchLive();
    const interval = window.setInterval(fetchLive, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  return {
    data,
    liveData,
    isLive: liveData?.source === "live",
    liveFrames: liveData?.live_frames ?? 0,
    framesNeeded: liveData?.frames_needed ?? 10,
    loading,
    error,
    refetch: fetchMetrics,
  };
};

export const useLiveMetrics = () => {
  const [liveData, setLiveData] = useState<LiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await getLiveMetrics();
        if (active) { setLiveData(result); setError(null); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (active) setLoading(false);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 3000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  return { liveData, loading, error, isLive: liveData?.source === "live" };
};

export const useLiveTimeline = () => {
  const [data, setData] = useState<LiveTimeline | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await getLiveTimeline();
        if (active) setData(result);
      } catch (err) {
        console.error("Failed to fetch live reconstruction timeline", err);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  return data;
};

export const useLiveRoc = () => {
  const [data, setData] = useState<LiveRocCurve | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await getLiveRoc();
        if (active) setData(result);
      } catch (err) {
        console.error("Failed to fetch live ROC curve", err);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 3000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  return data;
};

export const useLiveClusterValidation = () => {
  const [data, setData] = useState<LiveClusterValidation | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await getLiveClusterValidation();
        if (active) setData(result);
      } catch (err) {
        console.error("Failed to fetch live cluster validation", err);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 3000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  return data;
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
  const [aeThreshold, setAeThreshold] = useState<number>(0.75);
  const [ifScore, setIfScore] = useState<number>(0);
  const [lofScore, setLofScore] = useState<number>(0);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [faceFrameCount, setFaceFrameCount] = useState<number>(0);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [liveSignals, setLiveSignals] = useState({ eye_closure: false, yawn: false, model_consensus: false });
  const [faceDetected, setFaceDetected] = useState(false);
  const [sessionFrames, setSessionFrames] = useState(0);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const mounted = useRef(false);
  const wasAlerting = useRef(false);
  const reconnectTimer = useRef<number | undefined>(undefined);

  const [ws] = useState(() => new DetectionWebSocket());

  const connectWs = useCallback(() => {
    ws.connect(
      (data: MockFrameResponse) => {
        setAeError(data.ae_error);
        setAeThreshold(data.ae_threshold ?? 0.75);
        setIfScore(data.if_score);
        setLofScore(data.lof_score);
        setFrameCount(data.frame);
        setFaceFrameCount(data.valid_face_frames ?? 0);
        setFaceDetected(data.face_detected ?? false);
        setLiveSignals(data.live_signals ?? { eye_closure: false, yawn: false, model_consensus: false });
        setSessionFrames(data.session_frames ?? 0);
        if (data.live_metrics) setLiveMetrics(data.live_metrics);
        
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
    aeThreshold,
    ifScore,
    lofScore,
    frameCount,
    faceFrameCount,
    alertCount,
    liveSignals,
    faceDetected,
    sessionFrames,
    liveMetrics,
    reconnect: connectWs,
    sendFrame
  };
};
