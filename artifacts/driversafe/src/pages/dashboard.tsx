import { type ReactNode, useState } from 'react';
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

const reconstructionData = Array.from({ length: 50 }, (_, index) => ({
  frame: index * 80 + 40,
  error: index === 35 ? 0.96 : Number((0.24 + ((index * 17) % 23) / 100).toFixed(2)),
}));

const pcaAlert = Array.from({ length: 28 }, (_, index) => ({
  x: Number((-2.5 + ((index * 13) % 34) / 10).toFixed(2)),
  y: Number((1.2 + ((index * 7) % 23) / 10).toFixed(2)),
}));
const pcaTransition = Array.from({ length: 14 }, (_, index) => ({
  x: Number((-0.9 + ((index * 19) % 27) / 10).toFixed(2)),
  y: Number((-0.8 + ((index * 11) % 25) / 10).toFixed(2)),
}));
const pcaDrowsy = Array.from({ length: 9 }, (_, index) => ({
  x: Number((1.1 + ((index * 17) % 21) / 10).toFixed(2)),
  y: Number((-2.1 + ((index * 9) % 24) / 10).toFixed(2)),
}));

const tsneAlert = Array.from({ length: 24 }, (_, index) => ({
  x: Number((-3 + ((index * 7) % 17) / 10).toFixed(2)),
  y: Number((1 + ((index * 11) % 18) / 10).toFixed(2)),
}));
const tsneDrowsy = Array.from({ length: 18 }, (_, index) => ({
  x: Number((1.1 + ((index * 5) % 19) / 10).toFixed(2)),
  y: Number((-1.5 + ((index * 13) % 18) / 10).toFixed(2)),
}));
const tsneTransition = Array.from({ length: 10 }, (_, index) => ({
  x: Number((-0.9 + ((index * 17) % 19) / 10).toFixed(2)),
  y: Number((-0.7 + ((index * 3) % 15) / 10).toFixed(2)),
}));

const dbscanCore = Array.from({ length: 22 }, (_, index) => ({
  x: Number((-2.2 + ((index * 9) % 20) / 10).toFixed(2)),
  y: Number((1 + ((index * 5) % 18) / 10).toFixed(2)),
}));
const dbscanBorder = Array.from({ length: 10 }, (_, index) => ({
  x: Number((0.2 + ((index * 13) % 23) / 10).toFixed(2)),
  y: Number((-0.4 + ((index * 7) % 19) / 10).toFixed(2)),
}));
const dbscanNoise = Array.from({ length: 8 }, (_, index) => ({
  x: Number((-2.8 + ((index * 23) % 56) / 10).toFixed(2)),
  y: Number((-2.4 + ((index * 17) % 48) / 10).toFixed(2)),
}));
const dbscanOutlier = Array.from({ length: 6 }, (_, index) => ({
  x: Number((-3.5 + ((index * 29) % 67) / 10).toFixed(2)),
  y: Number((-2.8 + ((index * 19) % 53) / 10).toFixed(2)),
}));

const rocData = [
  { fpr: 0, tpr: 0 },
  { fpr: 0.08, tpr: 0.42 },
  { fpr: 0.18, tpr: 0.65 },
  { fpr: 0.32, tpr: 0.78 },
  { fpr: 0.49, tpr: 0.87 },
  { fpr: 0.7, tpr: 0.94 },
  { fpr: 1, tpr: 1 },
];

const alertRows = [
  ['047', '09:42:18', 'Drowsy', '1.84', '0.71', '2.3', '94%', 'AE + LOF'],
  ['046', '09:38:55', 'Yawn', '1.21', '0.58', '1.8', '78%', 'AE only'],
  ['045', '09:31:04', 'Drowsy', '2.10', '0.82', '2.9', '97%', 'All 3'],
  ['044', '09:22:37', 'Drowsy', '1.76', '0.69', '2.1', '91%', 'AE + IF'],
  ['043', '09:14:11', 'Yawn', '1.18', '0.54', '1.6', '72%', 'AE only'],
  ['042', '09:08:33', 'Drowsy', '1.92', '0.77', '2.5', '95%', 'AE + LOF'],
];

function chartColors() {
  return {
    cyan: '#74eaff',
    mint: '#9be2d3',
    amber: '#e8c58b',
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
    window.sessionStorage.removeItem('driversafe-session');
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
  const colors = chartColors();
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
        <AnalyticsStatCard value="3,842" label="Frames processed" note="Session active" testId="card-live-frames" />
        <AnalyticsStatCard value="47" label="Drowsy alerts" note="1.2% of frames" tone="alert" testId="card-live-alerts" />
        <AnalyticsStatCard value="0.87" label="F1-Score" note="Target met" tone="mint" testId="card-live-f1" />
        <AnalyticsStatCard value="64 min" label="Session duration" note="Ongoing" tone="amber" testId="card-live-duration" />
      </section>

      <div className="dashboard-live-grid">
        <div className="dashboard-live-primary">
          <DashboardPanel title="Live Webcam Feed" eyebrow="Attention stream" action={<span className="dashboard-panel-code">CAM / 01</span>}>
            <div className="dashboard-webcam">
              <span className="dashboard-feed-badge dashboard-feed-badge--active"><span /> Alert</span>
              <span className="dashboard-feed-badge dashboard-feed-badge--fps">30 FPS</span>
              <div className="dashboard-webcam-placeholder">
                <Camera aria-hidden="true" />
                <span>Camera feed ready</span>
                <small>Local stream is simulated for this session</small>
              </div>
              <span className="dashboard-webcam-readout">EAR: 0.31 · MAR: 0.12 · Head: stable</span>
            </div>
            <div className="dashboard-score-grid">
              <FeedScore label="Alert" value="Clear" tone="mint" />
              <FeedScore label="Error" value="0.42" />
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
                  <Line type="monotone" dataKey="error" stroke={colors.cyan} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Model Voting" eyebrow="Three-model consensus">
            <div className="dashboard-voting-grid">
              {[
                ['Autoencoder', 'Alert', '42%', 'cyan'],
                ['Iso. Forest', 'Alert', '35%', 'mint'],
                ['LOF', 'Drowsy', '58%', 'amber'],
              ].map(([model, state, score, tone]) => (
                <div className="dashboard-vote" key={model}>
                  <span>{model}</span>
                  <strong className={`dashboard-vote-state dashboard-vote-state--${state === 'Drowsy' ? 'alert' : 'clear'}`}>{state}</strong>
                  <div className="dashboard-vote-bar"><i className={`is-${tone}`} style={{ width: score }} /></div>
                  <small>{score} anomaly score</small>
                </div>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel title="Session Stats" eyebrow="At a glance">
            <div className="dashboard-session-stats">
              <div><strong>3,842</strong><span>Frames</span></div>
              <div><strong className="is-alert">47</strong><span>Alerts</span></div>
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
  const colors = chartColors();
  const elbowData = [95, 70, 48, 36, 28, 23, 20].map((wcss, index) => ({ k: `k=${index + 1}`, wcss }));
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
          { name: 'Drowsy', color: colors.amber, data: pcaDrowsy },
        ]} />
        <ScatterPanel title="t-SNE Visualization" eyebrow="Unit IV · Latent space" series={[
          { name: 'Alert cluster', color: colors.mint, data: tsneAlert },
          { name: 'Drowsy cluster', color: colors.amber, data: tsneDrowsy },
          { name: 'Transition', color: colors.amber, data: tsneTransition },
        ]} />
        <DashboardPanel title="Elbow Method — WCSS vs k" eyebrow="Unit II · Cluster validation" action={<span className="dashboard-panel-badge">Optimal k=3</span>}>
          <div className="dashboard-chart dashboard-chart--scatter">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={elbowData}>
                <CartesianGrid stroke={colors.line} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="k" tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: colors.muted, fontSize: 9 }} tickLine={false} axisLine={false} width={25} />
                <Tooltip contentStyle={{ background: colors.panel, border: `1px solid ${colors.line}`, color: colors.ice, fontSize: 11 }} />
                <Bar dataKey="wcss" radius={[3, 3, 0, 0]}>
                  {elbowData.map((entry) => <Cell key={entry.k} fill={entry.k === 'k=3' ? colors.cyan : 'rgba(116, 234, 255, 0.22)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="dashboard-chart-note">Optimal k=3 · Alert / Transition / Drowsy</p>
        </DashboardPanel>
        <ScatterPanel title="DBSCAN Output" eyebrow="Unit III · Density map" badge="39 noise pts" series={[
          { name: 'Core', color: colors.mint, data: dbscanCore },
          { name: 'Border', color: colors.amber, data: dbscanBorder },
          { name: 'Noise', color: colors.amber, data: dbscanNoise },
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
  const colors = chartColors();
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
            <MetricTile value="0.61" label="Silhouette score" note="Target &gt; 0.4" />
            <MetricTile value="1.12" label="Davies-Bouldin" note="Target &lt; 1.5" />
            <MetricTile value="284" label="WCSS / Inertia" note="At k=3" tone="cyan" />
            <MetricTile value="k=3" label="Optimal clusters" note="Elbow method" tone="cyan" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Detection Performance" eyebrow="Unit V · VI">
          <div className="dashboard-metric-tile-grid">
            <MetricTile value="0.87" label="F1-Score" note="Target &gt; 0.80" />
            <MetricTile value="0.91" label="ROC-AUC" note="Target &gt; 0.85" />
            <MetricTile value="83%" label="Precision" note="Target &gt; 80%" />
            <MetricTile value="89%" label="Recall" note="Target &gt; 85%" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Confusion Matrix" eyebrow="Detection outcomes">
          <div className="dashboard-confusion-matrix">
            <ConfusionCell value="312" label="True Positive" tone="mint" />
            <ConfusionCell value="18" label="False Positive" tone="alert" />
            <ConfusionCell value="9" label="False Negative" tone="alert" />
            <ConfusionCell value="3,503" label="True Negative" tone="mint" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="ROC Curve · AUC = 0.91" eyebrow="Detection threshold">
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

function downloadAlertCsv() {
  const header = ['#', 'Timestamp', 'State', 'AE Error', 'IF Score', 'LOF', 'Confidence', 'Models'];
  const csv = [header, ...alertRows].map((row) => row.join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'driversafe-alert-history.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function AlertHistory() {
  const colors = chartColors();
  const frequency = [60, 80, 40, 95, 55, 30, 70, 50, 65].map((alerts, index) => ({ time: `${index + 1}0m`, alerts }));
  return (
    <div className="dashboard-content dashboard-analytics-content" data-testid="panel-alert-history">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Session archive</p>
          <h2>Every alert, in context.</h2>
        </div>
        <span className="dashboard-session-code">LOG / 047 EVENTS</span>
      </div>
      <DashboardPanel title="Alert History Log" eyebrow="Live session ledger" action={(
        <div className="dashboard-history-actions">
          <span className="dashboard-alert-total">47 alerts</span>
          <button type="button" className="dashboard-export-button" onClick={downloadAlertCsv} data-testid="button-export-alerts">
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
              {alertRows.map(([id, time, state, ae, forest, lof, confidence, models]) => (
                <tr key={id} data-testid={`row-alert-${id}`}>
                  <td>{id}</td>
                  <td>{time}</td>
                  <td><span className={`dashboard-state-pill dashboard-state-pill--${state === 'Drowsy' ? 'alert' : 'amber'}`}>{state}</span></td>
                  <td>{ae}</td>
                  <td>{forest}</td>
                  <td>{lof}</td>
                  <td>{confidence}</td>
                  <td>{models}</td>
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
        <DashboardPanel title="Alert Breakdown" eyebrow="Session: 64 min · 3,842 frames processed">
          <div className="dashboard-breakdown">
            <BreakdownRow label="Drowsy alerts" value="31" tone="alert" />
            <BreakdownRow label="Yawn only" value="16" tone="amber" />
            <BreakdownRow label="Alert frames" value="3,795" tone="mint" />
            <div className="dashboard-breakdown-divider" />
            <BreakdownRow label="Total frames" value="3,842" tone="muted" />
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