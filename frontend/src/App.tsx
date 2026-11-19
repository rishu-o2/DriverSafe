import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Activity } from 'lucide-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import Dashboard from '@/pages/dashboard';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
gsap.registerPlugin(ScrollTrigger);

function Home() {
  const wrapperRef = useRef<HTMLElement>(null);
  const giantTextRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        giantTextRef.current,
        { y: '10vh', scale: 0.8, opacity: 0 },
        {
          y: '0vh',
          scale: 1,
          opacity: 1,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: 'top 80%',
            end: 'bottom bottom',
            scrub: 1,
          },
        },
      );

      gsap.fromTo(
        [headingRef.current, actionsRef.current],
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: 'top 40%',
            end: 'bottom bottom',
            scrub: 1,
          },
        },
      );
    }, wrapperRef);

    return () => context.revert();
  }, []);

  return (
    <main className="driversafe-page" data-testid="page-driversafe">
      <div className="aurora" aria-hidden="true" />
      <section className="intro" aria-label="DriverSafe introduction">
        <div className="intro-copy">
          <span>Scroll down to discover</span>
          <span className="scroll-line" aria-hidden="true" />
        </div>
      </section>

      <section ref={wrapperRef} className="curtain" data-testid="footer-driversafe">
        <div className="marquee-wrap" aria-label="DriverSafe capabilities">
          <div className="marquee-track">
            <span className="marquee-item">Drowsiness Detection</span>
            <span className="marquee-item">Unsupervised Learning</span>
            <span className="marquee-item">Real-Time Alerts</span>
            <span className="marquee-item">Facial Anomaly Recognition</span>
            <span className="marquee-item">Driver Safety AI</span>
            <span className="marquee-item">Drowsiness Detection</span>
            <span className="marquee-item">Unsupervised Learning</span>
            <span className="marquee-item">Real-Time Alerts</span>
            <span className="marquee-item">Facial Anomaly Recognition</span>
            <span className="marquee-item">Driver Safety AI</span>
          </div>
        </div>

        <p ref={giantTextRef} className="background-word" aria-hidden="true">DriverSafe</p>

        <div className="curtain-copy">
          <h1 ref={headingRef} className="curtain-title" data-testid="heading-driversafe">DriverSafe</h1>
          <p className="curtain-subtitle">Unsupervised Drowsiness Detection System</p>
          <div ref={actionsRef} className="hero-actions" data-testid="actions-demo">
            <MagneticLink href="/dashboard" icon={<Activity aria-hidden="true" />}>
              Open public demo
            </MagneticLink>
          </div>
        </div>

        <div className="curtain-footer">© 2026 Rishu. All Rights Reserved.</div>
      </section>
    </main>
  );
}

function MagneticLink({
  children,
  href,
  icon,
}: {
  children: ReactNode;
  href: string;
  icon: ReactNode;
}) {
  const handlePointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 8;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 8;
    event.currentTarget.style.setProperty('--mx', `${x}px`);
    event.currentTarget.style.setProperty('--my', `${y}px`);
  };

  const resetMagnet = (event: React.PointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.setProperty('--mx', '0px');
    event.currentTarget.style.setProperty('--my', '0px');
  };

  return (
    <Link
      href={href}
      className="glass-pill"
      data-testid={`link-${href.slice(1)}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetMagnet}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Dashboard} />
        <Route path="/signup" component={Dashboard} />
        <Route path="/welcome" component={Dashboard} />
        <Route path="/dashboard/welcome" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
