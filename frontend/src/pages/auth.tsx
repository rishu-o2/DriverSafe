import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login, signup } from '@/lib/api';

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === 'signup';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') || '');
    const password = String(form.get('password') || '');
    try {
      if (isSignup) await signup(username, password);
      else await login(username, password);
      setLocation('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete the request. Check that the server is running.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page" data-testid="page-auth">
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="mb-7 text-center">
          <div className="mb-3 inline-flex items-center gap-2 text-primary">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em]">DriverSafe</span>
          </div>
          <h1 id="auth-title" style={{ margin: 0, fontSize: 'clamp(1.7rem, 7vw, 2.1rem)', letterSpacing: '-0.04em', lineHeight: 1.15 }}>
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="!mb-0 !mt-2">Drowsiness detection via facial anomaly recognition</p>
        </header>

        {error && (
          <div role="alert" aria-live="assertive" className="mb-5 rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm leading-relaxed text-red-100">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={submit} aria-busy={busy}>
          <div className="grid gap-2">
            <Label htmlFor="auth-username" className="text-sm text-foreground">Username</Label>
            <Input
              id="auth-username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              aria-describedby="username-hint"
              className="min-h-12 rounded-lg bg-slate-950/50 px-3 text-base focus-visible:ring-2 focus-visible:ring-primary"
            />
            <p id="username-hint" className="!m-0 text-xs text-muted-foreground">Use 3 or more characters.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="auth-password" className="text-sm text-foreground">Password</Label>
            <div className="relative">
              <Input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                aria-describedby="password-hint"
                className="min-h-12 rounded-lg bg-slate-950/50 px-3 pr-14 text-base focus-visible:ring-2 focus-visible:ring-primary"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-12 w-12 rounded-lg text-muted-foreground hover:text-foreground focus-visible:ring-2"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
            <p id="password-hint" className="!m-0 text-xs text-muted-foreground">Use 8 or more characters.</p>
          </div>

          <Button type="submit" size="lg" disabled={busy} className="auth-submit mt-1 min-h-12 w-full rounded-lg text-sm font-semibold">
            {busy ? <><LoaderCircle aria-hidden="true" className="animate-spin" /> {isSignup ? 'Creating account…' : 'Logging in…'}</> : isSignup ? 'Create account' : 'Log in'}
          </Button>
        </form>

        <p className="!mb-0 !mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          Your video never leaves your device. Only facial feature numbers are sent.
        </p>

        <div className="mt-5 border-t border-border pt-4 text-center text-sm">
          <span className="text-muted-foreground">{isSignup ? 'Already have an account?' : 'New to DriverSafe?'}</span>{' '}
          <Link className="inline-flex min-h-11 items-center rounded px-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={isSignup ? '/login' : '/signup'}>
            {isSignup ? 'Log in' : 'Create account'}
          </Link>
        </div>
      </section>
    </main>
  );
}
