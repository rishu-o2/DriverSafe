import { useState, useEffect, useCallback } from "react";
import {
  getAllMetrics,
  getAlertHistory,
  getAlertStats,
  getValidation,
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

// --- useDetection ---

export const useDetection = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentState, setCurrentState] = useState<"ALERT" | "DROWSY" | "NORMAL">("NORMAL");
  const [aeError, setAeError] = useState<number>(0);
  const [ifScore, setIfScore] = useState<number>(0);
  const [lofScore, setLofScore] = useState<number>(0);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [alertCount, setAlertCount] = useState<number>(0);

  const [ws] = useState(() => new DetectionWebSocket());

  const connectWs = useCallback(() => {
    ws.connect(
      (data: MockFrameResponse) => {
        setAeError(data.ae_error);
        setIfScore(data.if_score);
        setLofScore(data.lof_score);
        setFrameCount(data.frame);
        
        if (data.is_drowsy) {
          setCurrentState("DROWSY");
          setAlertCount((prev) => prev + 1);
        } else {
          setCurrentState("NORMAL");
        }
      },
      (err) => {
        console.error("Detection WS error", err);
      },
      () => {
        setIsConnected(false);
        // Auto-reconnect after 3 seconds
        setTimeout(() => connectWs(), 3000);
      }
    );
    
    // Slight delay to allow connection to establish, or wait for first message
    setIsConnected(true); 
  }, [ws]);

  useEffect(() => {
    connectWs();
    return () => {
      ws.disconnect();
    };
  }, [connectWs, ws]);

  const sendFrame = useCallback((data: string) => {
    // Send string directly if it's already a string, or stringify if object
    ws.send(data as any); 
  }, [ws]);

  return {
    isConnected,
    currentState,
    aeError,
    ifScore,
    lofScore,
    frameCount,
    alertCount,
    reconnect: connectWs,
    sendFrame
  };
};
