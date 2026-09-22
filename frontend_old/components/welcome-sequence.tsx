import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Radio, ShieldCheck } from 'lucide-react';
import { useLocation } from 'wouter';

const NIGHT_DRIVE_VIDEO =
  'https://cdn.coverr.co/videos/coverr-driving-on-a-highway-at-night-1613/1080p.mp4';

export function WelcomeSequence() {
  const [, setLocation] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(0);
  const touchYRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const enterDashboard = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setLocation('/dashboard');
  }, [setLocation]);

  const updateProgress = useCallback(
    (nextValue: number) => {
      const next = Math.max(0, Math.min(1, nextValue));
      progressRef.current = next;
      setProgress(next);

      const video = videoRef.current;
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = next * video.duration;
      }

      if (next >= 1) enterDashboard();
    },
    [enterDashboard],
  );

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(prefersReducedMotion);
    const originalBodyStyle = document.body.style.cssText;
    const lockedScrollY = window.scrollY;
    const body = document.body.style;
    body.position = 'fixed';
    body.top = `-${lockedScrollY}px`;
    body.left = '0';
    body.right = '0';
    body.width = '100%';
    body.overscrollBehavior = 'none';

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      updateProgress(progressRef.current + event.deltaY / 3200);
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (touchYRef.current === null) return;
      event.preventDefault();
      const currentY = event.touches[0]?.clientY ?? touchYRef.current;
      updateProgress(progressRef.current + (touchYRef.current - currentY) / 2400);
      touchYRef.current = currentY;
    };

    const handleTouchEnd = () => {
      touchYRef.current = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        updateProgress(progressRef.current + 0.12);
      }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        updateProgress(progressRef.current - 0.12);
      }
      if (event.key === 'Enter' && reducedMotion) {
        event.preventDefault();
        enterDashboard();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.cssText = originalBodyStyle;
      window.scrollTo(0, lockedScrollY);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enterDashboard, reducedMotion, updateProgress]);

  return (
    <main
      className={`welcome-sequence${videoFailed ? ' welcome-sequence--fallback' : ''}`}
      data-testid="page-welcome"
      onClick={() => reducedMotion && enterDashboard()}
    >
      {!videoFailed && (
        <video
          ref={videoRef}
          className="welcome-video"
          src={NIGHT_DRIVE_VIDEO}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setVideoFailed(true)}
          data-testid="video-welcome-drive"
        />
      )}
      <div className="welcome-vignette" aria-hidden="true" />
      <div className="welcome-scanlines" aria-hidden="true" />

      <header className="welcome-header">
        <div className="welcome-system-mark" aria-hidden="true">
          <Radio />
        </div>
        <span className="welcome-header-label">DriverSafe / Secure Entry</span>
        <span className="welcome-header-time">INT396</span>
      </header>

      <section className="welcome-center" aria-label="Welcome to DriverSafe">
        <p className="welcome-eyebrow">
          <span className="welcome-live-dot" aria-hidden="true" />
          Safety layer initialized
        </p>
        <h1 data-testid="heading-welcome">Welcome Back</h1>
        <p
          className={`welcome-tagline${progress > 0.62 ? ' is-visible' : ''}`}
          data-testid="text-welcome-tagline"
        >
          Your safety system is active and watching.
        </p>
        {reducedMotion ? (
          <button
            type="button"
            className="welcome-enter-button"
            onClick={(event) => {
              event.stopPropagation();
              enterDashboard();
            }}
            data-testid="button-enter-dashboard"
          >
            Enter DriverSafe
            <ArrowRight aria-hidden="true" />
          </button>
        ) : (
          <div className="welcome-scroll-hint" data-testid="hint-scroll-enter">
            <span>SCROLL TO ENTER</span>
            <ArrowDown aria-hidden="true" />
          </div>
        )}
      </section>

      <div className="welcome-progress-track" aria-hidden="true">
        <div className="welcome-progress-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <footer className="welcome-footer">
        <div className="welcome-status" data-testid="status-system-active">
          <ShieldCheck aria-hidden="true" />
          <span>DriverSafe System</span>
          <span className="welcome-status-divider">/</span>
          <span>Status: Active</span>
        </div>
        <span className="welcome-signature" data-testid="text-signature">
          DriverSafe · INT396
        </span>
      </footer>
    </main>
  );
}