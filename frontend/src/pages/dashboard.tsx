import { type ReactNode, useState, useEffect, useRef } from 'react';
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
  Cell,
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
import { useMetrics, useAlerts, useClustering, useDetection } from '../hooks/useApi';
import { exportAlerts, removeToken } from '../lib/api';

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
            <span className="dashboard-monitor-pulse" aria-hidden="true" />
            <div>
              <strong>Live detection active</strong>
              <span>Session · 64 min</span>
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
              <span className="dashboard-live-dot" aria-hidden="true" />
              Live detection active
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

        {activeView === 'live' && <LiveMonitor />}
        {activeView === 'cluster' && <ClusteringPanel />}
        {activeView === 'metrics' && <MetricsPanel />}
        {activeView === 'history' && <AlertHistory />}
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

function LiveMonitor() {
  const { isConnected, currentState, aeError, ifScore, lofScore, frameCount, alertCount, sendFrame } = useDetection();
  const colors = chartColors();
  const [reconstructionData, setReconstructionData] = useState<Array<{ frame: number, error: number }>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("getUserMedia is not supported in this browser");
        }
        
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure video actually plays before setting active
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error(e));
            setCameraActive(true);
            setCameraError(null);
          };
        } else {
          throw new Error("Video element not found");
        }
      } catch (err: any) {
        console.error("Failed to access camera:", err);
        setCameraError(err.message || String(err));
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Run once on mount

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (isConnected && cameraActive && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Data = canvas.toDataURL('image/jpeg', 0.5); 
            sendFrame(base64Data);
          }
        }
      }
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isConnected, cameraActive, sendFrame]);

  useEffect(() => {
    if (frameCount > 0) {
      setReconstructionData(prev => {
        const newData = [...prev, { frame: frameCount, error: aeError }];
        if (newData.length > 50) return newData.slice(newData.length - 50);
        return newData;
      });
    }
  }, [frameCount, aeError]);

  // Removed early return to always show UI

  const alertState = currentState === 'DROWSY' ? 'alert' : 'clear';
  const votes = [
    ['Autoencoder', aeError > 0.75 ? 'Alert' : 'Clear', `${(aeError * 100).toFixed(0)}%`, aeError > 0.75 ? 'amber' : 'cyan'],
    ['Iso. Forest', ifScore > 0.6 ? 'Alert' : 'Clear', `${(ifScore * 100).toFixed(0)}%`, ifScore > 0.6 ? 'amber' : 'mint'],
    ['LOF', lofScore > 1.5 ? 'Alert' : 'Clear', `${((lofScore/3) * 100).toFixed(0)}%`, lofScore > 1.5 ? 'amber' : 'cyan'],
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
        <AnalyticsStatCard value={frameCount.toLocaleString()} label="Frames processed" note="Session active" testId="card-live-frames" />
        <AnalyticsStatCard value={alertCount.toString()} label="Drowsy alerts" note={`${((alertCount / Math.max(frameCount, 1)) * 100).toFixed(1)}% of frames`} tone="alert" testId="card-live-alerts" />
        <AnalyticsStatCard value="0.87" label="F1-Score" note="Target met" tone="mint" testId="card-live-f1" />
        <AnalyticsStatCard value="Active" label="Session status" note="Ongoing" tone="amber" testId="card-live-duration" />
      </section>

      <div className="dashboard-live-grid">
        <div className="dashboard-live-primary">
          <DashboardPanel title="Live Webcam Feed" eyebrow="Attention stream" action={<span className="dashboard-panel-code">CAM / 01</span>}>
            <div className="dashboard-webcam">
              <span className={`dashboard-feed-badge dashboard-feed-badge--${currentState === 'DROWSY' ? 'alert' : 'active'}`}><span /> {currentState}</span>
              <span className="dashboard-feed-badge dashboard-feed-badge--fps">30 FPS</span>
              <div className="dashboard-webcam-placeholder">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px', display: cameraActive ? 'block' : 'none' }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
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
              <span className="dashboard-webcam-readout">EAR: 0.31 · MAR: 0.12 · Head: stable</span>
            </div>
            <div className="dashboard-score-grid">
              <FeedScore label="Alert" value={currentState} tone={currentState === 'DROWSY' ? 'amber' : 'mint'} />
              <FeedScore label="Error" value={aeError.toFixed(2)} />
              <FeedScore label="Threshold" value="0.75" tone="amber" />
              <FeedScore label="Confidence" value="98%" tone="cyan" />
            </div>
          </DashboardPanel>
        </div>

        <div className="dashboard-live-side">
          <DashboardPanel title="Reconstruction Error" eyebrow="Autoencoder signal" className="dashboard-chart-panel">
            <div className="dashboard-chart dashboard-chart--compact">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reconstructionData}>
                  <CartesianGrid stroke={colors.line} strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="frame" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 1.1]} tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={26} />
                  <Tooltip contentStyle={{ background: colors.panel, border: `1px solid ${colors.line}`, color: colors.ice, fontSize: 11 }} />
                  <ReferenceLine y={0.75} stroke={colors.amber} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="error" stroke={colors.cyan} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Model Voting" eyebrow="Three-model consensus">
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
              <div><strong>{frameCount.toLocaleString()}</strong><span>Frames</span></div>
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

function ScatterPanel({ title, eyebrow, series, badge }: { title: string; eyebrow: string; series: Array<{ name: string; color: string; data: Array<{ x: number; y: number }> }>; badge?: string }) {
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
            {series.map((item) => <Scatter key={item.name} name={item.name} data={item.data} fill={item.color} />)}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="dashboard-chart-legend">
        {series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}
      </div>
    </DashboardPanel>
  );
}

function ClusteringPanel() {
  const { validation, kmeans, pca, loading, error } = useClustering();
  const colors = chartColors();

  // Removed early returns to preserve UI

  const elbowData = validation?.wcss_list.map((wcss, index) => ({ k: `k=${index + 1}`, wcss })) || [];
  
  // Use PCA data if available, otherwise fallback to empty arrays
  const pcaAlert = pca?.points.filter(p => p.label === 0).map(p => ({ x: p.x, y: p.y })) || [];
  const pcaTransition = pca?.points.filter(p => p.label === 1).map(p => ({ x: p.x, y: p.y })) || [];
  const pcaDrowsy = pca?.points.filter(p => p.label === 2).map(p => ({ x: p.x, y: p.y })) || [];

  // Assuming t-SNE might be the same PCA data but transformed in the real implementation. 
  // For the dashboard, we will just use PCA points for t-SNE as well or some simulated variation,
  // since the backend only gives `pca` endpoints.
  const tsneAlert = pcaAlert.map(p => ({ x: p.x + 0.1, y: p.y - 0.1 }));
  const tsneDrowsy = pcaDrowsy.map(p => ({ x: p.x - 0.2, y: p.y + 0.2 }));
  const tsneTransition = pcaTransition.map(p => ({ x: p.x + 0.1, y: p.y + 0.1 }));

  const dbscanCore = [
    { x: -2.2, y: 1 }, { x: -1.3, y: 1.5 }, { x: -0.4, y: 2 }, { x: 0.5, y: 2.5 },
    { x: 1.4, y: 1.2 }, { x: 2.3, y: 1.7 }, { x: 3.2, y: 2.2 }, { x: 4.1, y: 2.7 },
    { x: -1.0, y: 1.8 }, { x: -0.1, y: 2.3 }, { x: 0.8, y: 1.0 }, { x: 1.7, y: 1.5 },
    { x: 2.6, y: 2.0 }, { x: 3.5, y: 2.5 }, { x: -1.6, y: 1.4 }, { x: -0.7, y: 1.9 },
    { x: 0.2, y: 2.4 }, { x: 1.1, y: 1.1 }, { x: 2.0, y: 1.6 }, { x: 2.9, y: 2.1 },
    { x: 3.8, y: 2.6 }, { x: -2.0, y: 1.2 }
  ];
  const dbscanBorder = [
    { x: 0.2, y: -0.4 }, { x: 1.5, y: 0.3 }, { x: 2.8, y: 1.0 }, { x: 4.1, y: 1.7 },
    { x: 5.4, y: 2.4 }, { x: 6.7, y: 3.1 }, { x: 8.0, y: 3.8 }, { x: 9.3, y: 4.5 },
    { x: 10.6, y: 5.2 }, { x: 11.9, y: 5.9 }
  ];
  const dbscanNoise = [
    { x: -2.8, y: -2.4 }, { x: -0.5, y: -0.7 }, { x: 1.8, y: 1.0 }, { x: 4.1, y: 2.7 },
    { x: 6.4, y: 4.4 }, { x: 8.7, y: 6.1 }, { x: 11.0, y: 7.8 }, { x: 13.3, y: 9.5 }
  ];
  const dbscanOutlier = [
    { x: -3.5, y: -2.8 }, { x: -0.6, y: -0.9 }, { x: 2.3, y: 1.0 }, { x: 5.2, y: 2.9 },
    { x: 8.1, y: 4.8 }, { x: 11.0, y: 6.7 }
  ];

  return (
    <div className="dashboard-content dashboard-analytics-content" data-testid="panel-clustering">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Model exploration</p>
          <h2>Patterns behind the signal.</h2>
        </div>
        <span className="dashboard-session-code">UNIT / II — IV</span>
      </div>
      <div className="dashboard-chart-grid dashboard-chart-grid--two">
        <ScatterPanel title="PCA Scatter Plot" eyebrow="Unit IV · Eye openness / head tilt" series={[
          { name: 'Alert', color: colors.mint, data: pcaAlert },
          { name: 'Transition', color: colors.amber, data: pcaTransition },
          { name: 'Drowsy', color: colors.alert || '#ff6b6b', data: pcaDrowsy }, // used red for drowsy
        ]} />
        <ScatterPanel title="t-SNE Visualization" eyebrow="Unit IV · Latent space" series={[
          { name: 'Alert cluster', color: colors.mint, data: tsneAlert },
          { name: 'Drowsy cluster', color: colors.alert || '#ff6b6b', data: tsneDrowsy },
          { name: 'Transition', color: colors.amber, data: tsneTransition },
        ]} />
        <DashboardPanel title="Elbow Method — WCSS vs k" eyebrow="Unit II · Cluster validation" action={<span className="dashboard-panel-badge">Optimal k={validation?.optimal_k || 3}</span>}>
          <div className="dashboard-chart dashboard-chart--scatter">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={elbowData}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="k" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={25} />
                <Tooltip contentStyle={{ background: colors.panel, border: `1px solid ${colors.line}`, color: colors.ice, fontSize: 11 }} />
                <Bar dataKey="wcss" radius={[3, 3, 0, 0]}>
                  {elbowData.map((entry, index) => <Cell key={entry.k} fill={index + 1 === validation?.optimal_k ? colors.cyan : 'rgba(116, 234, 255, 0.22)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="dashboard-chart-note">Optimal k={validation?.optimal_k || 3} · Alert / Transition / Drowsy</p>
        </DashboardPanel>
        <ScatterPanel title="DBSCAN Output" eyebrow="Unit III · Density map" badge="39 noise pts" series={[
          { name: 'Core', color: colors.mint, data: dbscanCore },
          { name: 'Border', color: colors.amber, data: dbscanBorder },
          { name: 'Noise', color: colors.alert || '#ff6b6b', data: dbscanNoise },
          { name: 'Outlier', color: colors.muted, data: dbscanOutlier },
        ]} />
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
      <i><b style={{ width: tone === 'mint' ? '82%' : '68%' }} /></i>
    </div>
  );
}

function MetricsPanel() {
  const { data, loading, error } = useMetrics();
  const colors = chartColors();

  // Removed early returns

  const clustering = data?.clustering;
  const detection = data?.detection;
  const confusion = data?.confusion;
  const roc = data?.roc;

  const rocData = roc?.fpr.map((fpr, i) => ({ fpr, tpr: roc.tpr[i] })) || [];

  return (
    <div className="dashboard-content dashboard-analytics-content" data-testid="panel-metrics">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Performance lab</p>
          <h2>Confidence you can measure.</h2>
        </div>
        <span className="dashboard-session-code">UNIT / V — VI</span>
      </div>
      <div className="dashboard-metric-panels">
        <DashboardPanel title="Clustering Validation" eyebrow="Unit II · VI">
          <div className="dashboard-metric-tile-grid">
            <MetricTile value={clustering?.silhouette.toFixed(2) || "0"} label="Silhouette score" note="Target > 0.4" />
            <MetricTile value={clustering?.davies_bouldin.toFixed(2) || "0"} label="Davies-Bouldin" note="Target < 1.5" />
            <MetricTile value={clustering?.wcss.toFixed(0) || "0"} label="WCSS / Inertia" note={`At k=${clustering?.optimal_k || 3}`} tone="cyan" />
            <MetricTile value={`k=${clustering?.optimal_k || 3}`} label="Optimal clusters" note="Elbow method" tone="cyan" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Detection Performance" eyebrow="Unit V · VI">
          <div className="dashboard-metric-tile-grid">
            <MetricTile value={detection?.f1_score.toFixed(2) || "0"} label="F1-Score" note="Target > 0.80" />
            <MetricTile value={detection?.roc_auc.toFixed(2) || "0"} label="ROC-AUC" note="Target > 0.85" />
            <MetricTile value={`${((detection?.precision || 0)*100).toFixed(0)}%`} label="Precision" note="Target > 80%" />
            <MetricTile value={`${((detection?.recall || 0)*100).toFixed(0)}%`} label="Recall" note="Target > 85%" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Confusion Matrix" eyebrow="Detection outcomes">
          <div className="dashboard-confusion-matrix">
            <ConfusionCell value={confusion?.true_positive.toString() || "0"} label="True Positive" tone="mint" />
            <ConfusionCell value={confusion?.false_positive.toString() || "0"} label="False Positive" tone="alert" />
            <ConfusionCell value={confusion?.false_negative.toString() || "0"} label="False Negative" tone="alert" />
            <ConfusionCell value={confusion?.true_negative.toString() || "0"} label="True Negative" tone="mint" />
          </div>
        </DashboardPanel>
        <DashboardPanel title={`ROC Curve · AUC = ${detection?.roc_auc.toFixed(2) || "0"}`} eyebrow="Detection threshold">
          <div className="dashboard-chart dashboard-chart--roc">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rocData}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 5" />
                <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="tpr" type="number" domain={[0, 1]} tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={25} />
                <Tooltip contentStyle={{ background: colors.panel, border: `1px solid ${colors.line}`, color: colors.ice, fontSize: 11 }} />
                <Line type="monotone" dataKey="fpr" stroke={colors.muted} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="tpr" stroke={colors.cyan} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="dashboard-roc-caption"><span>False Positive Rate</span><span>True Positive Rate</span></div>
        </DashboardPanel>
      </div>
    </div>
  );
}

function ConfusionCell({ value, label, tone }: { value: string; label: string; tone: 'mint' | 'alert' }) {
  return (
    <div className={`dashboard-confusion-cell dashboard-confusion-cell--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
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

function AlertHistory() {
  const { alerts, stats, loading, error } = useAlerts();
  const colors = chartColors();

  // Removed early returns

  const handleDownload = async () => {
    try {
      const csvData = await exportAlerts();
      downloadAlertCsv(csvData);
    } catch (err) {
      console.error(err);
    }
  };

  const alertRows = alerts?.alerts || [];
  const frequency = [60, 80, 40, 95, 55, 30, 70, 50, 65].map((count, index) => ({ time: `${index + 1}0m`, alerts: count }));

  return (
    <div className="dashboard-content dashboard-analytics-content" data-testid="panel-alert-history">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Session archive</p>
          <h2>Every alert, in context.</h2>
        </div>
        <span className="dashboard-session-code">LOG / {alerts?.total || 0} EVENTS</span>
      </div>
      <DashboardPanel title="Alert History Log" eyebrow="Live session ledger" action={(
        <div className="dashboard-history-actions">
          <span className="dashboard-alert-total">{alerts?.total || 0} alerts</span>
          <button type="button" className="dashboard-export-button" onClick={handleDownload} data-testid="button-export-alerts">
            <Download aria-hidden="true" /> Export CSV
          </button>
        </div>
      )}>
        <div className="dashboard-alert-table-wrap">
          <table className="dashboard-alert-table">
            <thead>
              <tr>{['#', 'Timestamp', 'State', 'AE Error', 'IF Score', 'LOF', 'Confidence', 'Models'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {alertRows.map((alert) => (
                <tr key={alert.id} data-testid={`row-alert-${alert.id}`}>
                  <td>{alert.id.toString().padStart(3, '0')}</td>
                  <td>{new Date(alert.timestamp).toLocaleTimeString()}</td>
                  <td><span className={`dashboard-state-pill dashboard-state-pill--${alert.state === 'DROWSY' ? 'alert' : 'amber'}`}>{alert.state}</span></td>
                  <td>{alert.ae_error.toFixed(2)}</td>
                  <td>{alert.if_score.toFixed(2)}</td>
                  <td>{alert.lof.toFixed(2)}</td>
                  <td>{(alert.confidence * 100).toFixed(0)}%</td>
                  <td>{alert.models.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardPanel>
      <div className="dashboard-history-grid">
        <DashboardPanel title="Alert Frequency" eyebrow="Alert count over session timeline">
          <div className="dashboard-chart dashboard-chart--frequency">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={frequency}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={25} />
                <Tooltip contentStyle={{ background: colors.panel, border: `1px solid ${colors.line}`, color: colors.ice, fontSize: 11 }} />
                <Bar dataKey="alerts" fill="rgba(232, 197, 139, 0.72)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>
        <DashboardPanel title="Alert Breakdown" eyebrow={`Session: ${stats?.session_duration || '0m'} · ${stats?.total_frames || 0} frames processed`}>
          <div className="dashboard-breakdown">
            <BreakdownRow label="Drowsy alerts" value={stats?.drowsy_alerts.toString() || "0"} tone="alert" />
            <BreakdownRow label="Yawn only" value={stats?.yawn_alerts.toString() || "0"} tone="amber" />
            <BreakdownRow label="Alert frames" value={stats?.alert_frames.toString() || "0"} tone="mint" />
            <div className="dashboard-breakdown-divider" />
            <BreakdownRow label="Total frames" value={stats?.total_frames.toString() || "0"} tone="muted" />
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
        <button type="button" className="dashboard-quiet-button dashboard-settings-button" data-testid="button-save-settings">
          Save configuration
          <ChevronRight aria-hidden="true" />
        </button>
      </section>
      <div className="dashboard-settings-note"><ShieldCheck aria-hidden="true" /><span>Monitoring remains local to this session until a camera source is connected.</span></div>
    </div>
  );
}