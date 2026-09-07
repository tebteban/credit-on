import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AccessState = 'CHECKING' | 'SIGNED_OUT' | 'FORBIDDEN' | 'AUTHORIZED';

function isAdmin(session: Session | null): boolean {
  return session?.user.app_metadata?.credit_on_role === 'admin';
}

function AdminLoginScreen({ forbidden = false }: { forbidden?: boolean }): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    forbidden ? 'Esta cuenta no tiene permiso de administrador.' : null
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    if (!isAdmin(data.session)) {
      await supabase.auth.signOut();
      setError('Esta cuenta es de cobrador y no puede acceder al sistema administrativo.');
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 p-5 flex items-center justify-center font-sans">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-9 text-slate-950">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-base font-black text-emerald-400 shadow-lg">
            CO
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-950/70">CREDIT-ON</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Acceso administrativo</h1>
          <p className="mt-2 text-sm font-medium text-slate-950/75">
            Gestión de créditos, cobranzas y arqueo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-8">
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-xs font-bold text-slate-300">
              Correo electrónico
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              placeholder="admin@credit-on.com"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-xs font-bold text-slate-300">
              Contraseña
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-900/70 bg-rose-950/50 px-3.5 py-3 text-xs font-medium text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">lock_open</span>
            {loading ? 'Validando acceso…' : 'Ingresar al sistema'}
          </button>
        </form>

        <p className="border-t border-slate-800 px-8 py-4 text-center text-[11px] text-slate-500">
          Acceso restringido a personal administrador autorizado.
        </p>
      </section>
    </main>
  );
}

export function AdminAccessGate({ children }: { children: ReactNode }): JSX.Element {
  const [access, setAccess] = useState<AccessState>('CHECKING');

  useEffect(() => {
    if (!supabase) {
      setAccess('SIGNED_OUT');
      return;
    }

    let active = true;
    const updateAccess = async (session: Session | null) => {
      if (!active) return;

      if (!session) {
        setAccess('SIGNED_OUT');
        return;
      }

      if (isAdmin(session)) {
        setAccess('AUTHORIZED');
        return;
      }

      setAccess('FORBIDDEN');
      await supabase.auth.signOut();
    };

    supabase.auth.getSession().then(({ data }) => updateAccess(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void updateAccess(session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (access === 'CHECKING') {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-sm font-semibold text-slate-300">
        Verificando acceso seguro…
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center font-sans text-slate-100">
        <section className="max-w-md rounded-2xl border border-amber-700/60 bg-slate-900 p-7 shadow-xl">
          <span className="material-symbols-outlined text-4xl text-amber-400">settings</span>
          <h1 className="mt-3 text-lg font-bold">Supabase no está configurado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Creá <code className="text-amber-300">.env.local</code> a partir de <code className="text-amber-300">.env.example</code> y reiniciá la aplicación.
          </p>
        </section>
      </main>
    );
  }

  if (access !== 'AUTHORIZED') {
    return <AdminLoginScreen forbidden={access === 'FORBIDDEN'} />;
  }

  return <>{children}</>;
}
