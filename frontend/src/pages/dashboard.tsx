import { type ReactNode, useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Camera,
  ChevronRight,
  Download,
  LogOut,
  Menu,
  ScatterChart as ScatterChartIcon,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link, useLocation } from 'wouter';
import { removeToken, resetLiveSession } from '../lib/api';
import { useDetection } from '../hooks/useApi';
import { createFaceLandmarker, extractFaceFeatures } from '../lib/face-landmarks';

type DashboardView = 'live' | 'cluster' | 'metrics' | 'history' | 'settings';

const viewLabels: Record<DashboardView, string> = {
  live: 'Live Monitor',
  cluster: 'Clustering',
  metrics: 'Metrics',
  history: 'Alert History',
  settings: 'System settings',
};

const navigation: Array<{
  id: Exclude<DashboardView, 'settings'>;
  label: string;
  icon: typeof Activity;
}> = [
  { id: 'live', label: 'Live Monitor', icon: Activity },
  { id: 'cluster', label: 'Clustering', icon: ScatterChartIcon },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'history', label: 'Alert History', icon: Bell },
];

const tabs: Array<{ id: Exclude<DashboardView, 'settings'>; label: string }> = [
  { id: 'live', label: 'Live Monitor' },
  { id: 'cluster', label: 'Clustering' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'history', label: 'Alert History' },
];

function formatSessionDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
}

function chartColors() {
  return {
    cyan: '#74eaff',
    mint: '#9be2d3',
    amber: '#e8c58b',
    alert: '#ff6b6b',
    ice: '#e7eef5',
    muted: 'rgba(184, 207, 212, 0.48)',
    line: 'rgba(157, 211, 222, 0.16)',
    panel: '#0f1823',
  };
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [activeView, setActiveView] = useState<DashboardView>('live');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const detection = useDetection();
  const [sessionSeconds, setSessionSeconds] = useState(0);

  useEffect(() => {
    if (!detection.isConnected) return;

    const connectedAt = Date.now();
    const updateElapsed = () => setSessionSeconds(Math.floor((Date.now() - connectedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [detection.isConnected]);

  const sessionDuration = formatSessionDuration(sessionSeconds);
  const sessionStatus = detection.isConnected ? 'Live detection connected' : 'Detection disconnected';

  const signOut = () => {
    removeToken();
    setLocation('/login');
  };

  const selectView = (view: DashboardView) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  return (
    <main className="dashboard-page dashboard-analytics-page" data-testid="page-dashboard">
      <div className="dashboard-atmosphere" aria-hidden="true" />
      <aside className={`dashboard-sidebar${mobileNavOpen ? ' is-open' : ''}`} data-testid="dashboard-sidebar">
        <div className="dashboard-brand-row">
          <Link href="/" className="dashboard-brand" data-testid="link-dashboard-brand">
            <span className="dashboard-brand-mark" aria-hidden="true" />
            DriverSafe
          </Link>
          <button type="button" className="dashboard-close-nav" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="dashboard-profile">
          <div className="dashboard-avatar" aria-hidden="true">RS</div>
          <div>
            <strong>Rishu Sharma</strong>
            <span>Unsupervised detection</span>
          </div>
          <span className="dashboard-profile-dot" aria-label="Profile active" />
        </div>

        <p className="dashboard-nav-label">Control room</p>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`dashboard-nav-item${activeView === id ? ' is-active' : ''}`}
              onClick={() => selectView(id)}
              data-testid={`button-nav-${id}`}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              {activeView === id && <ChevronRight aria-hidden="true" />}
            </button>
          ))}
        </nav>

        <div className="dashboard-sidebar-divider" />
        <button
          type="button"
          className={`dashboard-nav-item dashboard-settings-nav${activeView === 'settings' ? ' is-active' : ''}`}
          onClick={() => selectView('settings')}
          data-testid="button-nav-settings"
        >
          <Settings aria-hidden="true" />
          <span>System settings</span>
          {activeView === 'settings' && <ChevronRight aria-hidden="true" />}
        </button>

        <div className="dashboard-sidebar-bottom">
          <div className="dashboard-monitor-note">
            <span className={`dashboard-monitor-pulse${detection.isConnected ? '' : ' is-offline'}`} aria-hidden="true" />
            <div>
              <strong>{sessionStatus}</strong>
              <span>Session · {sessionDuration}</span>
            </div>
          </div>
          <button type="button" className="dashboard-signout" onClick={signOut} data-testid="button-sign-out">
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <button type="button" className="dashboard-nav-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" data-testid="button-navigation-scrim" />
      )}

      <section className="dashboard-main">
        <header className="dashboard-topbar dashboard-analytics-topbar">
          <button type="button" className="dashboard-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation">
            <Menu aria-hidden="true" />
          </button>
          <div>
            <p className="dashboard-breadcrumb">DriverSafe / Monitoring console</p>
            <h1>{viewLabels[activeView]}</h1>
          </div>
          <div className="dashboard-top-actions">
            <div className="dashboard-live-chip" data-testid="status-dashboard-live">
              <span className={`dashboard-live-dot${detection.isConnected ? '' : ' is-offline'}`} aria-hidden="true" />
              {sessionStatus}
            </div>
            <div className="dashboard-avatar dashboard-top-avatar" aria-label="Rishu Sharma">RS</div>
            <button type="button" className="dashboard-icon-button" aria-label="Sign out" onClick={signOut} data-testid="button-top-sign-out">
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </header>

        <nav className="dashboard-tab-nav" aria-label="Dashboard views">
          {tabs.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              className={`dashboard-tab${activeView === id ? ' is-active' : ''}`}
              onClick={() => selectView(id)}
              data-testid={`button-tab-${id}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div style={{ display: activeView === 'live' ? 'block' : 'none' }}><LiveMonitor detection={detection} sessionDuration={sessionDuration} /></div>
        {activeView === 'cluster' && <ClusteringPanel detection={detection} />}
        {activeView === 'metrics' && <MetricsPanel detection={detection} />}
        {activeView === 'history' && <AlertHistory detection={detection} sessionDuration={sessionDuration} />}
        {activeView === 'settings' && <SettingsPanel />}
      </section>
    </main>
  );
}

function DashboardPanel({ title, eyebrow, action, children, className = '' }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`dashboard-analytics-panel ${className}`}>
      <div className="dashboard-analytics-panel-heading">
        <div>
          {eyebrow && <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> {eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AnalyticsStatCard({ value, label, note, tone = 'cyan', testId }: { value: string; label: string; note: string; tone?: 'cyan' | 'mint' | 'amber' | 'alert'; testId: string }) {
  return (
    <article className={`dashboard-analytics-stat dashboard-analytics-stat--${tone}`} data-testid={testId}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </article>
  );
}

function LiveMonitor({ detection, sessionDuration }: { detection: ReturnType<typeof useDetection>; sessionDuration: string }) {
  const { isConnected, currentState, aeError, aeThreshold, ifScore, lofScore, faceFrameCount, alertCount, liveSignals, faceDetected, sendFrame } = detection;
  const colors = chartColors();
  const liveTimeline = {
    timeline: detection.recentResults.map((result) => ({
      frame: result.frame,
      error: result.ae_error,
      threshold: result.ae_threshold ?? aeThreshold,
      is_drowsy: result.is_drowsy,
    })),
    threshold: aeThreshold,
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<Awaited<ReturnType<typeof createFaceLandmarker>> | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState('Camera: requesting access');
  const [detectorStatus, setDetectorStatus] = useState('MediaPipe: loading runtime and model');
  const [mediaPipeFaceDetected, setMediaPipeFaceDetected] = useState(false);

  const formatError = (error: unknown) => {
    if (error instanceof Error) return error.name ? `${error.name}: ${error.message}` : error.message;
    return String(error);
  };

  useEffect(() => {
    let active = true;
    createFaceLandmarker()
      .then((landmarker) => {
        if (active) {
          landmarkerRef.current = landmarker;
          setDetectorStatus('MediaPipe: initialized');
        }
      })
      .catch((error) => {
        console.error('Failed to load the face landmark model:', error);
        if (active) setDetectorStatus(`MediaPipe initialization error: ${formatError(error)}`);
      });
    return () => {
      active = false;
      landmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        setCameraStatus('Camera: requesting access');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("getUserMedia is not supported in this browser");
        }
        
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { ideal: 'user' },
          },
        });
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            setCameraActive(false);
            setCameraStatus('Camera: stream ended');
          });
        });
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
              .then(() => { setCameraActive(true); setCameraError(null); setCameraStatus('Camera: active'); })
              .catch(e => {
                const detail = formatError(e);
                setCameraError(detail);
                setCameraStatus(`Camera playback error: ${detail}`);
              });
          };
          videoRef.current.srcObject = stream;
        } else {
          throw new Error("Video element not found");
        }
      } catch (err: any) {
        console.error("Failed to access camera:", err);
        const detail = formatError(err);
        setCameraError(detail);
        setCameraStatus(`Camera access error: ${detail}`);
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []); // Run once on mount

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!landmarkerRef.current) return;
      if (!cameraActive || !videoRef.current) {
        setMediaPipeFaceDetected(false);
        setDetectorStatus('MediaPipe: idle · camera unavailable');
        return;
      }
      if (!isConnected) {
        setMediaPipeFaceDetected(false);
        setDetectorStatus('MediaPipe: idle · detection connection unavailable');
        return;
      }

      const video = videoRef.current;
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        setDetectorStatus('MediaPipe: waiting for video frames');
        return;
      }
      try {
        const result = landmarkerRef.current.detectForVideo(video, performance.now());
        const landmarks = result.faceLandmarks?.[0];
        const features = extractFaceFeatures(landmarks, video.videoWidth, video.videoHeight);
        setMediaPipeFaceDetected(Boolean(landmarks));
        if (!landmarks) {
          setDetectorStatus('MediaPipe: no face landmarks · check lighting, framing, and camera focus');
        } else if (!features) {
          setDetectorStatus(`MediaPipe: landmarks rejected · ${landmarks.length} points`);
        } else {
          setDetectorStatus(`MediaPipe: face detected · ${landmarks.length} landmarks`);
        }
        if (!sendFrame(JSON.stringify({ face_detected: Boolean(features), features }))) {
          setDetectorStatus('MediaPipe: face found, but detection WebSocket is not open');
        }
      } catch (error) {
        console.error('Face landmark detection failed:', error);
        setMediaPipeFaceDetected(false);
        setDetectorStatus(`MediaPipe detection error: ${formatError(error)}`);
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isConnected, cameraActive, sendFrame]);

  // Removed early return to always show UI

  const votes = [
    ['Eye closure', liveSignals.eye_closure ? 'Alert' : 'Clear', liveSignals.eye_closure ? '100%' : '0%', liveSignals.eye_closure ? 'amber' : 'cyan'],
    ['Yawn', liveSignals.yawn ? 'Alert' : 'Clear', liveSignals.yawn ? '100%' : '0%', liveSignals.yawn ? 'amber' : 'mint'],
    ['ML consensus', liveSignals.model_consensus ? 'Alert' : 'Clear', liveSignals.model_consensus ? '100%' : '0%', liveSignals.model_consensus ? 'amber' : 'cyan'],
  ];
  return (
    <div className="dashboard-content dashboard-analytics-content" data-testid="panel-live-monitor">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Unit I · Live session</p>
          <h2>Keep your focus. We’ll watch the signal.</h2>
        </div>
        <span className="dashboard-session-code">SESSION / DS-INT396</span>
      </div>

      <section className="dashboard-analytics-stat-grid" aria-label="Live session statistics">
        <AnalyticsStatCard value={detection.faceFramesSent.toLocaleString()} label="Face frames sent" note={faceFrameCount > 0 ? `${faceFrameCount} acknowledged by backend` : detection.faceFramesSent > 0 ? 'Waiting for backend acknowledgement' : 'Waiting for MediaPipe feature frames'} testId="card-live-frames" />
        <AnalyticsStatCard value={alertCount.toString()} label="Drowsy events" note="Alert episodes this session" tone="alert" testId="card-live-alerts" />
        <AnalyticsStatCard value={detection.liveMetrics?.avg_ae_error?.toFixed(2) || 'N/A'} label="Live AE error" note={`${faceFrameCount} live face frames`} tone="amber" testId="card-live-f1" />
        <AnalyticsStatCard value={detection.modelAvailable === false ? 'Rules only' : isConnected ? 'Active' : 'Offline'} label="Session status" note={detection.modelAvailable === false ? 'Inference models unavailable; temporal eye/yawn cues remain active' : isConnected ? `Connected · ${sessionDuration}` : 'Waiting for backend connection'} tone="amber" testId="card-live-duration" />
      </section>

      <div className="dashboard-live-grid">
        <div className="dashboard-live-primary">
          <DashboardPanel title="Live Webcam Feed" eyebrow="Attention stream" action={<span className="dashboard-panel-code">CAM / 01</span>}>
            <div className="dashboard-webcam">
              <span className={`dashboard-feed-badge dashboard-feed-badge--${currentState === 'DROWSY' ? 'alert' : 'active'}`}><span /> {!cameraActive ? (cameraError ? 'CAMERA ERROR' : 'CAMERA') : !isConnected ? 'OFFLINE' : detectorStatus.startsWith('MediaPipe: loading') ? 'LOADING' : detectorStatus.startsWith('MediaPipe initialization error') ? 'MODEL ERROR' : mediaPipeFaceDetected ? (faceDetected ? currentState : 'FACE DETECTED') : 'NO FACE'}</span>
              <span className="dashboard-feed-badge dashboard-feed-badge--fps">{isConnected ? '4 FPS' : 'Offline'}</span>
              <div className="dashboard-webcam-placeholder">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px', display: cameraActive ? 'block' : 'none' }}
                />
                {!cameraActive && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 16px' }}>
                    <Camera aria-hidden="true" style={{ marginBottom: '8px', color: cameraError ? '#e8c58b' : 'inherit' }} />
                    <span style={{ color: cameraError ? '#e8c58b' : 'inherit' }}>
                      {cameraError ? 'Camera Error' : 'Connecting camera...'}
                    </span>
                    <small style={{ color: cameraError ? 'rgba(232, 197, 139, 0.7)' : 'inherit', marginTop: '4px' }}>
                      {cameraError || 'Please allow webcam access'}
                    </small>
                  </div>
                )}
              </div>
              <span className="dashboard-webcam-readout">{cameraStatus} · {detectorStatus}</span>
            </div>
            <div className="dashboard-score-grid">
              <FeedScore label="Alert" value={currentState} tone={currentState === 'DROWSY' ? 'amber' : 'mint'} />
              <FeedScore label="AE error" value={aeError.toFixed(2)} />
              <FeedScore label="IF score" value={ifScore.toFixed(3)} tone={ifScore < 0 ? 'amber' : 'mint'} />
              <FeedScore label="LOF score" value={lofScore.toFixed(3)} tone={lofScore < 0 ? 'amber' : 'mint'} />
            </div>
          </DashboardPanel>
        </div>

        <div className="dashboard-live-side">
          <DashboardPanel title="Reconstruction Error" eyebrow="Autoencoder signal" className="dashboard-chart-panel">
            <div className="dashboard-chart dashboard-chart--compact">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveTimeline?.timeline || []}>
                  <CartesianGrid stroke={colors.line} strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="frame" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, Math.max(1.1, aeThreshold * 1.1)]} tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={26} />
                  <Tooltip contentStyle={{ background: colors.panel, border: `1px solid ${colors.line}`, color: colors.ice, fontSize: 11 }} />
                  <ReferenceLine y={liveTimeline?.threshold ?? aeThreshold} stroke={colors.amber} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="error" stroke={colors.cyan} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Live Drowsiness Signals" eyebrow="Temporal stream analysis">
            <div className="dashboard-voting-grid">
              {votes.map(([model, state, score, tone]) => (
                <div className="dashboard-vote" key={model}>
                  <span>{model}</span>
                  <strong className={`dashboard-vote-state dashboard-vote-state--${state === 'Alert' ? 'alert' : 'clear'}`}>{state}</strong>
                  <div className="dashboard-vote-bar"><i className={`is-${tone}`} style={{ width: score }} /></div>
                  <small>{score} anomaly score</small>
                </div>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel title="Session Stats" eyebrow="At a glance">
            <div className="dashboard-session-stats">
              <div><strong>{faceFrameCount.toLocaleString()}</strong><span>Face frames</span></div>
              <div><strong className={alertCount > 0 ? "is-alert" : ""}>{alertCount}</strong><span>Alerts</span></div>
            </div>
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}

function FeedScore({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'mint' | 'cyan' | 'amber' | 'neutral' }) {
  return (
    <div className={`dashboard-feed-score dashboard-feed-score--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScatterPanel({ title, eyebrow, series, badge }: { title: string; eyebrow: string; series: Array<{ name: string; color: string; data: Array<{ x: number; y: number }>; shape?: 'circle' | 'square'; opacity?: number }>; badge?: string }) {
  const colors = chartColors();
  return (
    <DashboardPanel title={title} eyebrow={eyebrow} action={badge && <span className="dashboard-panel-badge">{badge}</span>}>
      <div className="dashboard-chart dashboard-chart--scatter">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 10, bottom: 5, left: -12 }}>
            <CartesianGrid stroke={colors.line} strokeDasharray="3 5" />
            <XAxis type="number" dataKey="x" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis type="number" dataKey="y" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={25} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: colors.panel, border: `1px solid ${colors.line}`, color: colors.ice, fontSize: 11 }} />
            {series.map((item) => <Scatter key={item.name} name={item.name} data={item.data} fill={item.color} shape={item.shape} fillOpacity={item.opacity ?? 1} />)}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="dashboard-chart-legend">
        {series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}
      </div>
    </DashboardPanel>
  );
}

function clusterLiveFeatures(features: number[][]) {
  const points = features.slice(-100).filter((row) => row.length >= 4).map((row) => ({ x: row[2], y: row[3] }));
  if (points.length < 3) return { points: [] as Array<{ x: number; y: number; label: number; density_label: number }>, elbow: [] as Array<{ k: string; wcss: number }>, silhouette: null as number | null, daviesBouldin: null as number | null };

  const runKMeans = (count: number) => {
    const ordered = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    let centers = Array.from({ length: count }, (_, index) => ({ ...ordered[Math.floor(index * (ordered.length - 1) / count)] }));
    let labels = points.map(() => 0);
    for (let iteration = 0; iteration < 8; iteration += 1) {
      labels = points.map((point) => centers.reduce((best, center, index) => {
        const distance = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
        const bestCenter = centers[best];
        return distance < (point.x - bestCenter.x) ** 2 + (point.y - bestCenter.y) ** 2 ? index : best;
      }, 0));
      centers = centers.map((center, label) => {
        const members = points.filter((_, index) => labels[index] === label);
        return members.length ? { x: members.reduce((sum, point) => sum + point.x, 0) / members.length, y: members.reduce((sum, point) => sum + point.y, 0) / members.length } : center;
      });
    }
    const wcss = points.reduce((sum, point, index) => sum + (point.x - centers[labels[index]].x) ** 2 + (point.y - centers[labels[index]].y) ** 2, 0);
    return { labels, centers, wcss };
  };
  const kmeans = runKMeans(Math.min(3, points.length));
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const scaleX = Math.sqrt(points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0) / points.length) || 1;
  const scaleY = Math.sqrt(points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0) / points.length) || 1;
  const normalized = points.map((point) => ({ x: (point.x - meanX) / scaleX, y: (point.y - meanY) / scaleY }));
  const densityLabels = Array(points.length).fill(-2) as number[];
  let cluster = 0;
  const getNeighbors = (index: number) => normalized.flatMap((point, other) => Math.hypot(point.x - normalized[index].x, point.y - normalized[index].y) <= 0.7 ? [other] : []);
  for (let index = 0; index < points.length; index += 1) {
    if (densityLabels[index] !== -2) continue;
    const nearby = getNeighbors(index);
    if (nearby.length < 4) { densityLabels[index] = -1; continue; }
    densityLabels[index] = cluster;
    const queue = [...nearby];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const candidate = queue[cursor];
      if (densityLabels[candidate] === -1) densityLabels[candidate] = cluster;
      if (densityLabels[candidate] !== -2) continue;
      densityLabels[candidate] = cluster;
      const expanded = getNeighbors(candidate);
      if (expanded.length >= 4) queue.push(...expanded);
    }
    cluster += 1;
  }
  const elbow = Array.from({ length: Math.min(5, points.length) }, (_, index) => {
    const count = index + 1;
    return { k: `k=${count}`, wcss: runKMeans(count).wcss };
  });
  const activeLabels = [...new Set(kmeans.labels)];
  let silhouette: number | null = null;
  let daviesBouldin: number | null = null;
  if (activeLabels.length > 1 && activeLabels.length < points.length) {
    const scores = points.map((point, index) => {
      const label = kmeans.labels[index];
      const within = points.filter((_, other) => kmeans.labels[other] === label && other !== index);
      if (!within.length) return 0;
      const a = within.reduce((sum, other) => sum + Math.hypot(point.x - other.x, point.y - other.y), 0) / within.length;
      const b = activeLabels.filter((otherLabel) => otherLabel !== label).map((otherLabel) => {
        const group = points.filter((_, other) => kmeans.labels[other] === otherLabel);
        return group.reduce((sum, other) => sum + Math.hypot(point.x - other.x, point.y - other.y), 0) / group.length;
      }).reduce((best, value) => Math.min(best, value), Number.POSITIVE_INFINITY);
      return (b - a) / Math.max(a, b, 1e-9);
    });
    silhouette = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const scatters = activeLabels.map((label) => {
      const group = points.filter((_, index) => kmeans.labels[index] === label);
      const center = kmeans.centers[label];
      return group.reduce((sum, point) => sum + Math.hypot(point.x - center.x, point.y - center.y), 0) / group.length;
    });
    const ratios = activeLabels.map((label, index) => activeLabels.filter((_, other) => other !== index).map((otherLabel) => {
      const left = kmeans.centers[label];
      const right = kmeans.centers[otherLabel];
      return (scatters[index] + scatters[otherLabel]) / Math.max(Math.hypot(left.x - right.x, left.y - right.y), 1e-9);
    }).reduce((max, ratio) => Math.max(max, ratio), 0));
    daviesBouldin = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  }
  return {
    points: points.map((point, index) => ({ ...point, label: kmeans.labels[index], density_label: densityLabels[index] === -2 ? -1 : densityLabels[index] })),
    elbow,
    silhouette,
    daviesBouldin,
  };
}

function ClusteringPanel({ detection }: { detection: ReturnType<typeof useDetection> }) {
  const liveClustering = useMemo(() => clusterLiveFeatures(detection.recentFeatures), [detection.recentFeatures]);
  const livePoints = liveClustering.points;
  const colors = chartColors();
  const clusterLabels = [...new Set(livePoints.map((point) => point.label))].sort((a, b) => a - b);
  const liveClusterSeries = clusterLabels.map((label, index) => ({
    name: 'K-means cluster ' + (label + 1),
    color: [colors.cyan, colors.amber, colors.alert][index % 3],
    shape: 'square' as const,
    data: livePoints.filter((point) => point.label === label).map(({ x, y }) => ({ x, y })),
  }));
  const densityLabels = [...new Set(livePoints.map((point) => point.density_label))].sort((a, b) => a - b);
  const liveDensitySeries = densityLabels.map((label, index) => ({
    name: label < 0 ? 'Noise' : 'Density cluster ' + (label + 1),
    color: label < 0 ? colors.muted : [colors.cyan, colors.amber, colors.mint][index % 3],
    data: livePoints.filter((point) => point.density_label === label).map(({ x, y }) => ({ x, y })),
  }));
  const liveDensityClusterCount = densityLabels.filter((label) => label >= 0).length;
  const noiseCount = livePoints.filter((point) => point.density_label === -1).length;

  return (
    <div className="dashboard-content dashboard-analytics-content" data-testid="panel-clustering">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Live feature analysis</p>
          <h2>Patterns in this camera session.</h2>
        </div>
        <span className="dashboard-session-code">{livePoints.length} LIVE FRAMES</span>
      </div>
      <p className="dashboard-chart-note">Clustering runs on recent webcam landmarks: average eye aspect ratio and mouth aspect ratio.</p>
      <div className="dashboard-chart-grid dashboard-chart-grid--two">
        <ScatterPanel title="Live K-means clusters" eyebrow="Current camera feature stream" badge={livePoints.length + ' frames'} series={liveClusterSeries} />
        <ScatterPanel title="Live density clusters" eyebrow="DBSCAN · normalized live features" badge={noiseCount + ' noise'} series={liveDensitySeries} />
        <DashboardPanel title="Live Cluster Summary" eyebrow="Calculated from current camera frames">
          <div className="dashboard-metric-tile-grid">
            <MetricTile value={livePoints.length ? clusterLabels.length.toString() : 'N/A'} label="K-means clusters" note="Current live window" />
            <MetricTile value={livePoints.length ? liveDensityClusterCount.toString() : 'N/A'} label="DBSCAN clusters" note={livePoints.length + ' current live frames'} tone="cyan" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Live Elbow Method · WCSS vs k" eyebrow="Computed from current webcam frames">
          <div className="dashboard-chart dashboard-chart--scatter">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={liveClustering.elbow}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="k" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={25} />
                <Tooltip contentStyle={{ background: colors.panel, border: '1px solid ' + colors.line, color: colors.ice, fontSize: 11 }} />
                <Bar dataKey="wcss" fill="rgba(116, 234, 255, 0.55)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="dashboard-chart-note">{livePoints.length < 3 ? 'Waiting for at least 3 live face frames.' : 'Eye openness and mouth opening from the latest live window.'}</p>
        </DashboardPanel>
      </div>
    </div>
  );
}
function MetricTile({ value, label, note, tone = 'mint' }: { value: string; label: string; note: string; tone?: 'mint' | 'cyan' }) {
  return (
    <div className={`dashboard-metric-tile dashboard-metric-tile--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </div>
  );
}

function MetricsPanel({ detection }: { detection: ReturnType<typeof useDetection> }) {
  const colors = chartColors();
  const summary = detection.liveMetrics;
  const chartData = detection.recentResults.slice(-60).map((result) => ({
    frame: result.frame,
    ae_error: result.ae_error,
    threshold: result.ae_threshold ?? detection.aeThreshold,
    if_score: result.if_score,
    lof_score: result.lof_score,
  }));
  const liveValue = (value: number | null | undefined, digits = 0) => value == null ? 'N/A' : value.toFixed(digits);

  return (
    <div className="dashboard-content dashboard-analytics-content" data-testid="panel-metrics">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Live performance</p>
          <h2>Measurements from this camera session.</h2>
        </div>
        <span className="dashboard-session-code">{detection.isConnected ? 'LIVE' : 'WAITING FOR STREAM'}</span>
      </div>
      <p className="dashboard-chart-note">Counts and model scores come directly from the live detection WebSocket. F1 and ROC are unavailable because this stream has no ground-truth labels.</p>
      <div className="dashboard-metric-panels">
        <DashboardPanel title="Live Session Counts" eyebrow="Current browser stream">
          <div className="dashboard-metric-tile-grid">
            <MetricTile value={detection.sessionFrames.toString()} label="Frames received" note="Current live session" />
            <MetricTile value={detection.faceFrameCount.toString()} label="Face frames" note="Accepted by live detector" tone="cyan" />
            <MetricTile value={detection.liveMetrics?.drowsy_frames?.toString() || '0'} label="Drowsy frames" note="Current stream window" />
            <MetricTile value={detection.alertCount.toString()} label="Drowsy events" note="Rising alert transitions" tone="cyan" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Live Signal Summary" eyebrow="Recent face frames">
          <div className="dashboard-metric-tile-grid">
            <MetricTile value={liveValue(summary?.avg_ae_error, 3)} label="Mean AE error" note="Observed live frames" />
            <MetricTile value={liveValue(summary?.avg_if_score, 3)} label="Mean IF score" note="Observed live frames" tone="cyan" />
            <MetricTile value={liveValue(summary?.avg_lof_score, 3)} label="Mean LOF score" note="Observed live frames" />
            <MetricTile value={summary?.model_consensus_frames?.toString() || '0'} label="Model consensus frames" note="Live model output" tone="cyan" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Live Drowsiness Cues" eyebrow="Temporal signals from current frames">
          <div className="dashboard-metric-tile-grid">
            <MetricTile value={summary?.eye_closure_frames?.toString() || '0'} label="Eye closure frames" note="Sustained closure signal" />
            <MetricTile value={summary?.yawn_frames?.toString() || '0'} label="Yawn frames" note="Sustained mouth opening" tone="cyan" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Live Model Scores" eyebrow="Latest WebSocket frames">
          <div className="dashboard-chart dashboard-chart--roc">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 5" />
                <XAxis dataKey="frame" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={34} />
                <Tooltip contentStyle={{ background: colors.panel, border: '1px solid ' + colors.line, color: colors.ice, fontSize: 11 }} />
                <Line type="monotone" dataKey="ae_error" name="AE error" stroke={colors.cyan} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="threshold" name="AE threshold" stroke={colors.amber} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="if_score" name="IF score" stroke={colors.mint} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="lof_score" name="LOF score" stroke={colors.alert} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
function downloadAlertCsv(csvData: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csvData], { type: 'text/csv;charset=utf-8' }));
  link.download = 'driversafe-alert-history.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function AlertHistory({ detection, sessionDuration }: { detection: ReturnType<typeof useDetection>; sessionDuration: string }) {
  const colors = chartColors();
  const alertRows = detection.alerts;
  const yawnEvents = alertRows.filter((alert) => alert.models.some((model) => model.toLowerCase().includes('yawn'))).length;
  const handleDownload = () => {
    const headers = ['id', 'timestamp', 'frame', 'state', 'ae_error', 'if_score', 'lof', 'confidence', 'models'];
    const rows = alertRows.map((alert) => [alert.id, alert.timestamp, alert.frame ?? '', alert.state, alert.ae_error, alert.if_score, alert.lof, alert.confidence, alert.models.join('|')]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => '"' + String(cell).replaceAll('"', '""') + '"').join(',')).join('\n');
    downloadAlertCsv(csv);
  };
  const now = Date.now();
  const frequency = Array.from({ length: 9 }, (_, index) => {
    const start = now - (8 - index) * 10 * 60_000;
    const end = start + 10 * 60_000;
    return {
      time: new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      alerts: alertRows.filter((alert) => {
        const timestamp = new Date(alert.timestamp).getTime();
        return timestamp >= start && timestamp < end;
      }).length,
    };
  });

  return (
    <div className="dashboard-content dashboard-analytics-content" data-testid="panel-alert-history">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Live session alerts</p>
          <h2>Events from the current camera stream.</h2>
        </div>
        <span className="dashboard-session-code">{alertRows.length} LIVE EVENTS</span>
      </div>
      <p className="dashboard-chart-note">This list is recorded from drowsy transitions received over the active WebSocket. It resets when this dashboard session ends.</p>
      <DashboardPanel title="Live Alert Log" eyebrow="Current browser session" action={(
        <div className="dashboard-history-actions">
          <span className="dashboard-alert-total">{alertRows.length} alerts</span>
          <button type="button" className="dashboard-export-button" onClick={handleDownload} data-testid="button-export-alerts">
            <Download aria-hidden="true" /> Export CSV
          </button>
        </div>
      )}>
        <div className="dashboard-alert-table-wrap">
          <table className="dashboard-alert-table">
            <thead>
              <tr>{['#', 'Timestamp', 'State', 'AE Error', 'IF Score', 'LOF', 'Confidence', 'Signals'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {alertRows.map((alert) => (
                <tr key={alert.id} data-testid={'row-alert-' + alert.id}>
                  <td>{alert.id.toString().padStart(3, '0')}</td>
                  <td>{new Date(alert.timestamp).toLocaleTimeString()}</td>
                  <td><span className="dashboard-state-pill dashboard-state-pill--alert">{alert.state}</span></td>
                  <td>{alert.ae_error.toFixed(3)}</td>
                  <td>{alert.if_score.toFixed(3)}</td>
                  <td>{alert.lof.toFixed(3)}</td>
                  <td>{(alert.confidence * 100).toFixed(0)}%</td>
                  <td>{alert.models.join(', ')}</td>
                </tr>
              ))}
              {!alertRows.length && <tr><td colSpan={8}>No drowsy events in this live session.</td></tr>}
            </tbody>
          </table>
        </div>
      </DashboardPanel>
      <div className="dashboard-history-grid">
        <DashboardPanel title="Live Alert Frequency" eyebrow="Current session · 10 minute windows">
          <div className="dashboard-chart dashboard-chart--frequency">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={frequency}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={25} />
                <Tooltip contentStyle={{ background: colors.panel, border: '1px solid ' + colors.line, color: colors.ice, fontSize: 11 }} />
                <Bar dataKey="alerts" fill="rgba(232, 197, 139, 0.72)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>
        <DashboardPanel title="Live Alert Breakdown" eyebrow={'Session: ' + sessionDuration + ' · ' + detection.sessionFrames + ' frames'}>
          <div className="dashboard-breakdown">
            <BreakdownRow label="Drowsy events" value={detection.alertCount.toString()} tone="alert" />
            <BreakdownRow label="Yawn-tagged events" value={yawnEvents.toString()} tone="amber" />
            <BreakdownRow label="Drowsy frames" value={(detection.liveMetrics?.drowsy_frames ?? 0).toString()} tone="mint" />
            <div className="dashboard-breakdown-divider" />
            <BreakdownRow label="Face frames" value={detection.faceFrameCount.toString()} tone="muted" />
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
function BreakdownRow({ label, value, tone }: { label: string; value: string; tone: 'alert' | 'amber' | 'mint' | 'muted' }) {
  return <div className="dashboard-breakdown-row"><span>{label}</span><strong className={`is-${tone}`}>{value}</strong></div>;
}

function SettingsPanel() {
  const [resetStatus, setResetStatus] = useState('');
  const resetSession = async () => {
    try {
      await resetLiveSession();
      setResetStatus('Live session reset');
    } catch {
      setResetStatus('Could not reset live session');
    }
  };
  return (
    <div className="dashboard-content dashboard-analytics-content dashboard-subpage" data-testid="panel-settings">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> System control</p>
          <h2>Your safety layer, your rules.</h2>
        </div>
      </div>
      <section className="dashboard-card dashboard-settings-card">
        {[
          ['Drowsiness detection', 'Active', true],
          ['Distraction cues', 'Active', true],
          ['Quiet hours', '22:00 — 06:00', false],
        ].map(([label, value, active]) => (
          <div className="dashboard-setting-row" key={label as string}>
            <div><strong>{label as string}</strong><small>Personal monitoring preference</small></div>
            <span className={active ? 'dashboard-setting-active' : ''}>{value as string}</span>
          </div>
        ))}
        <button type="button" className="dashboard-quiet-button dashboard-settings-button" data-testid="button-reset-live-session" onClick={resetSession}>
          Reset Live Session
          <ChevronRight aria-hidden="true" />
        </button>
        {resetStatus && <small role="status">{resetStatus}</small>}
      </section>
      <div className="dashboard-settings-note"><ShieldCheck aria-hidden="true" /><span>Monitoring remains local to this session until a camera source is connected.</span></div>
    </div>
  );
}
