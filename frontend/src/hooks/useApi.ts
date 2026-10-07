import { useState, useEffect, useCallback, useRef } from "react";
import {
  DetectionWebSocket,
  DetectionFrameResponse,
  LiveMetrics,
  Alert,
} from "../lib/api";

// --- useDetection ---

const summarizeLiveResults = (results: DetectionFrameResponse[]): LiveMetrics => {
  const faceResults = results.filter((result) => result.face_detected);
  const average = (pick: (result: DetectionFrameResponse) => number) => faceResults.length
    ? faceResults.reduce((total, result) => total + pick(result), 0) / faceResults.length
    : null;
  return {
    f1_score: null,
    roc_auc: null,
    precision: null,
    recall: null,
    accuracy: null,
    confusion: null,
    source: "live",
    metric_kind: "live_stream_summary",
    frames_needed: 0,
    live_frames: results.length,
    total_frames: results.length,
    drowsy_frames: results.filter((result) => result.is_drowsy).length,
    alert_frames: results.filter((result) => result.is_drowsy).length,
    avg_ae_error: average((result) => result.ae_error),
    avg_if_score: average((result) => result.if_score),
    avg_lof_score: average((result) => result.lof_score),
    eye_closure_frames: results.filter((result) => result.live_signals?.eye_closure).length,
    yawn_frames: results.filter((result) => result.live_signals?.yawn).length,
    model_consensus_frames: results.filter((result) => result.live_signals?.model_consensus).length,
  };
};

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
  const [recentResults, setRecentResults] = useState<DetectionFrameResponse[]>([]);
  const [recentFeatures, setRecentFeatures] = useState<number[][]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [modelAvailable, setModelAvailable] = useState<boolean | null>(null);
  const resultsRef = useRef<DetectionFrameResponse[]>([]);
  const featuresRef = useRef<number[][]>([]);
  const mounted = useRef(false);
  const wasAlerting = useRef(false);
  const reconnectTimer = useRef<number | undefined>(undefined);

  const [ws] = useState(() => new DetectionWebSocket());

  const connectWs = useCallback(() => {
    ws.connect(
      (data: DetectionFrameResponse) => {
        setAeError(data.ae_error);
        setAeThreshold(data.ae_threshold ?? 0.75);
        setIfScore(data.if_score);
        setLofScore(data.lof_score);
        setFrameCount((previous) => previous + 1);
        setFaceFrameCount((previous) => previous + (data.face_detected ? 1 : 0));
        setFaceDetected(data.face_detected ?? false);
        setLiveSignals(data.live_signals ?? { eye_closure: false, yawn: false, model_consensus: false });
        setSessionFrames((previous) => previous + 1);
        if (typeof data.model_available === "boolean") setModelAvailable(data.model_available);

        const nextResults = [...resultsRef.current, data].slice(-120);
        resultsRef.current = nextResults;
        setRecentResults(nextResults);
        if (data.features?.length === 20 && data.face_detected) {
          const nextFeatures = [...featuresRef.current, data.features].slice(-120);
          featuresRef.current = nextFeatures;
          setRecentFeatures(nextFeatures);
        }
        setLiveMetrics(summarizeLiveResults(nextResults));
        
        if (data.is_drowsy) {
          setCurrentState("DROWSY");
          if (!wasAlerting.current) {
            setAlertCount((prev) => prev + 1);
            const modelAlerts = data.model_alerts ?? { autoencoder: false, isolation_forest: false, lof: false };
            setAlerts((previous) => [{
              id: Date.now(),
              timestamp: new Date().toISOString(),
              state: "DROWSY",
              ae_error: data.ae_error,
              if_score: data.if_score,
              lof: data.lof_score,
              confidence: data.confidence ?? 0,
              models: data.models ?? Object.entries(modelAlerts).filter(([, active]) => active).map(([name]) => name),
              frame: data.frame,
            }, ...previous].slice(0, 100));
          }
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
    recentResults,
    recentFeatures,
    alerts,
    modelAvailable,
    reconnect: connectWs,
    sendFrame
  };
};
