import { type ReactNode, useState } from 'react';
import {
  Activity,
  Bell,
  CarFront,
  ChevronRight,
  CircleHelp,
  Eye,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Signal,
  Sparkles,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

type DashboardSection = 'overview' | 'drives' | 'alerts' | 'settings';

const navigation: Array<{
  id: DashboardSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'drives', label: 'Drive history', icon: CarFront },
  { id: 'alerts', label: 'Safety events', icon: Bell },
  { id: 'settings', label: 'System settings', icon: Settings },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const signOut = () => {
    window.sessionStorage.removeItem('driversafe-session');
    setLocation('/login');
  };

  const selectSection = (section: DashboardSection) => {
    setActiveSection(section);
    setMobileNavOpen(false);
  };

  return (
    <main className="dashboard-page" data-testid="page-dashboard">
      <div className="dashboard-atmosphere" aria-hidden="true" />
      <aside className={`dashboard-sidebar${mobileNavOpen ? ' is-open' : ''}`} data-testid="dashboard-sidebar">
        <div className="dashboard-brand-row">
          <Link href="/" className="dashboard-brand" data-testid="link-dashboard-brand">
            <span className="dashboard-brand-mark" aria-hidden="true" />
            DriverSafe
          </Link>
          <button
            type="button"
            className="dashboard-close-nav"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            data-testid="button-close-navigation"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="dashboard-profile">
          <div className="dashboard-avatar" aria-hidden="true">RS</div>
          <div>
            <strong>Rishu Sharma</strong>
            <span>Personal safety layer</span>
          </div>
          <span className="dashboard-profile-dot" aria-label="Profile active" />
        </div>

        <p className="dashboard-nav-label">Control room</p>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`dashboard-nav-item${activeSection === id ? ' is-active' : ''}`}
              onClick={() => selectSection(id)}
              data-testid={`button-nav-${id}`}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              {activeSection === id && <ChevronRight aria-hidden="true" />}
            </button>
          ))}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <div className="dashboard-monitor-note">
            <span className="dashboard-monitor-pulse" aria-hidden="true" />
            <div>
              <strong>Monitoring active</strong>
              <span>Last sync 2 min ago</span>
            </div>
          </div>
          <button
            type="button"
            className="dashboard-signout"
            onClick={signOut}
            data-testid="button-sign-out"
          >
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          className="dashboard-nav-scrim"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation overlay"
          data-testid="button-navigation-scrim"
        />
      )}

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <button
            type="button"
            className="dashboard-menu-button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            data-testid="button-open-navigation"
          >
            <Menu aria-hidden="true" />
          </button>
          <div>
            <p className="dashboard-breadcrumb">DriverSafe / Control room</p>
            <h1>{activeSection === 'overview' ? 'Good evening, Rishu.' : navigation.find((item) => item.id === activeSection)?.label}</h1>
          </div>
          <div className="dashboard-top-actions">
            <button type="button" className="dashboard-icon-button" aria-label="View safety alerts" data-testid="button-view-alerts" onClick={() => selectSection('alerts')}>
              <Bell aria-hidden="true" />
              <span className="dashboard-alert-count">2</span>
            </button>
            <div className="dashboard-live-chip" data-testid="status-dashboard-live">
              <span className="dashboard-live-dot" aria-hidden="true" />
              Live
            </div>
          </div>
        </header>

        {activeSection === 'overview' && <OverviewPanel onViewAlerts={() => selectSection('alerts')} />}
        {activeSection === 'drives' && <DrivesPanel />}
        {activeSection === 'alerts' && <AlertsPanel />}
        {activeSection === 'settings' && <SettingsPanel />}
      </section>
    </main>
  );
}

function OverviewPanel({ onViewAlerts }: { onViewAlerts: () => void }) {
  return (
    <div className="dashboard-content">
      <section className="dashboard-hero-panel" data-testid="card-monitoring-status">
        <div className="dashboard-hero-copy">
          <div className="dashboard-kicker"><span className="dashboard-kicker-line" /> Current drive profile</div>
          <h2>Clear road.<br /><em>Clear focus.</em></h2>
          <p>DriverSafe is watching the signals that matter, so you can keep your attention where it belongs.</p>
          <button type="button" className="dashboard-quiet-button" onClick={onViewAlerts} data-testid="button-review-alerts">
            Review safety events
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <div className="dashboard-radar" aria-label="Monitoring radar visualization">
          <div className="dashboard-radar-ring dashboard-radar-ring--outer" />
          <div className="dashboard-radar-ring dashboard-radar-ring--middle" />
          <div className="dashboard-radar-ring dashboard-radar-ring--inner" />
          <div className="dashboard-radar-cross dashboard-radar-cross--vertical" />
          <div className="dashboard-radar-cross dashboard-radar-cross--horizontal" />
          <div className="dashboard-radar-sweep" />
          <span className="dashboard-radar-core" />
          <span className="dashboard-radar-label dashboard-radar-label--top">ATTENTION / 98</span>
          <span className="dashboard-radar-label dashboard-radar-label--bottom">SAFE ZONE</span>
        </div>
      </section>

      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Live telemetry</p>
          <h2>Safety at a glance</h2>
        </div>
        <span className="dashboard-updated">Updated just now</span>
      </div>

      <section className="dashboard-metrics-grid" aria-label="Driver safety metrics">
        <MetricCard icon={<Eye aria-hidden="true" />} label="Attention score" value="98" unit="/ 100" note="Focused and steady" tone="cyan" testId="attention" />
        <MetricCard icon={<Gauge aria-hidden="true" />} label="Drive readiness" value="Good" unit="" note="No intervention needed" tone="mint" testId="readiness" />
        <MetricCard icon={<Moon aria-hidden="true" />} label="Rest signal" value="8.4" unit=" hrs" note="Sleep target met" tone="amber" testId="rest" />
      </section>

      <section className="dashboard-lower-grid">
        <div className="dashboard-card dashboard-event-card">
          <div className="dashboard-card-heading">
            <div>
              <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> Recent signal</p>
              <h3>Nothing to interrupt you.</h3>
            </div>
            <Activity aria-hidden="true" />
          </div>
          <div className="dashboard-event-empty">
            <div className="dashboard-event-icon"><ShieldCheck aria-hidden="true" /></div>
            <div>
              <strong>All clear since 06:42</strong>
              <p>No drowsiness or distraction events detected on your latest drive.</p>
            </div>
          </div>
        </div>
        <div className="dashboard-card dashboard-streak-card">
          <div className="dashboard-card-heading">
            <div>
              <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> This week</p>
              <h3>Quiet miles</h3>
            </div>
            <Sparkles aria-hidden="true" />
          </div>
          <div className="dashboard-streak-value">184<span> mi</span></div>
          <div className="dashboard-week-bars" aria-label="Weekly drive activity">
            {[38, 56, 32, 78, 62, 92, 48].map((height, index) => (
              <div className="dashboard-day" key={index}>
                <span style={{ height: `${height}%` }} className={index === 5 ? 'is-today' : ''} />
                <small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  note,
  tone,
  testId,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  note: string;
  tone: 'cyan' | 'mint' | 'amber';
  testId: string;
}) {
  return (
    <article className={`dashboard-card dashboard-metric-card dashboard-metric-card--${tone}`} data-testid={`card-metric-${testId}`}>
      <div className="dashboard-metric-top">
        <span className="dashboard-metric-icon">{icon}</span>
        <span className="dashboard-metric-signal"><Signal aria-hidden="true" /> live</span>
      </div>
      <p>{label}</p>
      <strong>{value}<small>{unit}</small></strong>
      <span className="dashboard-metric-note">{note}</span>
    </article>
  );
}

function DrivesPanel() {
  return (
    <div className="dashboard-content dashboard-subpage">
      <PanelIntro eyebrow="Drive archive" title="Every mile, accounted for." copy="A private record of the moments that shape your driving profile." />
      <section className="dashboard-card dashboard-table-card" data-testid="card-drive-history">
        <div className="dashboard-table-heading"><span>Recent drives</span><span>Safety status</span><span>Duration</span></div>
        {[
          ['Home → Studio', 'Today, 06:42', 'Clear', '38 min'],
          ['Studio → Home', 'Yesterday, 18:16', 'Clear', '41 min'],
          ['North loop', 'Tue, 09:08', 'Clear', '24 min'],
        ].map(([route, date, status, duration], index) => (
          <div className="dashboard-table-row" key={route} data-testid={`row-drive-${index}`}>
            <div><CarFront aria-hidden="true" /><strong>{route}</strong><small>{date}</small></div>
            <span className="dashboard-clear-status"><span />{status}</span>
            <span>{duration}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function AlertsPanel() {
  return (
    <div className="dashboard-content dashboard-subpage">
      <PanelIntro eyebrow="Signal review" title="Safety events, in context." copy="DriverSafe only raises a flag when a pattern is worth your attention." />
      <section className="dashboard-alert-list" data-testid="list-safety-alerts">
        <article className="dashboard-card dashboard-alert-row">
          <div className="dashboard-alert-marker dashboard-alert-marker--amber"><Bell aria-hidden="true" /></div>
          <div><strong>Break suggested</strong><p>Rest signal softened after 2h 18m of continuous driving.</p><small>Yesterday · 18:16</small></div>
          <span className="dashboard-alert-reviewed">Reviewed</span>
        </article>
        <article className="dashboard-card dashboard-alert-row">
          <div className="dashboard-alert-marker dashboard-alert-marker--cyan"><Eye aria-hidden="true" /></div>
          <div><strong>Attention recovered</strong><p>Focus returned to baseline within 14 seconds.</p><small>Mon · 11:04</small></div>
          <span className="dashboard-alert-reviewed">Reviewed</span>
        </article>
      </section>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="dashboard-content dashboard-subpage">
      <PanelIntro eyebrow="System settings" title="Your safety layer, your rules." copy="The current configuration is tuned for calm, useful intervention." />
      <section className="dashboard-card dashboard-settings-card" data-testid="card-system-settings">
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
    </div>
  );
}

function PanelIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="dashboard-panel-intro">
      <p className="dashboard-kicker"><span className="dashboard-kicker-line" /> {eyebrow}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
      <CircleHelp aria-hidden="true" />
    </div>
  );
}