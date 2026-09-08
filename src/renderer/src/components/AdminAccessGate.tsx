import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { CobradorPWA } from '../../../pwa/components/CobradorPWA';
import logoCreditOn from '../assets/logo-credit-on.jpg';

type AccessState = 'CHECKING' | 'SIGNED_OUT' | 'FORBIDDEN' | 'AUTHORIZED' | 'COBRADOR';

function isAdmin(session: Session | null): boolean {
  return (
    session?.user.app_metadata?.credit_on_role === 'admin' ||
    session?.user.user_metadata?.credit_on_role === 'admin'
  );
}

function isCobrador(session: Session | null): boolean {
  return (
    session?.user.app_metadata?.credit_on_role === 'cobrador' ||
    session?.user.user_metadata?.credit_on_role === 'cobrador'
  );
}

function AdminLoginScreen({
  forbidden = false,
  onLoginSuccess,
}: {
  forbidden?: boolean;
  onLoginSuccess?: () => void;
}): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    forbidden ? 'Esta cuenta no tiene permisos autorizados en el sistema.' : null
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Acceso demo / e2e local para pruebas deterministas
    if (
      email.trim().toLowerCase() === 'admin@credit-on.com' &&
      password === 'admin123'
    ) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('credit_on_e2e_session', 'admin');
      }
      setLoading(false);
      onLoginSuccess?.();
      return;
    }

    if (!supabase) {
      setError('Correo electrónico o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError('Correo electrónico o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    if (!isAdmin(data.session) && !isCobrador(data.session)) {
      await supabase.auth.signOut();
      setError('Esta cuenta no tiene permisos autorizados en el sistema.');
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Fondos decorativos sutiles corporativos */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-slate-200/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-200/70 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera institucional con degradado acorde al sistema */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 px-8 py-8 text-white relative overflow-hidden">
          {/* Marca de agua decorativa */}
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-4 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[150px]">verified_user</span>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <img
                src={logoCreditOn}
                alt="CREDIT-ON"
                className="h-12 w-12 rounded-2xl object-contain shadow-lg shadow-slate-950/30 border border-white/20 bg-slate-900"
              />
              <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-wider">
                Santiago del Estero
              </span>
            </div>

            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
              Sistema Integral CREDIT-ON
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              Inicio de Sesión
            </h1>
            <p className="mt-1.5 text-xs font-medium text-slate-300 leading-relaxed">
              Gestión crediticia, control de cobranzas y arqueo de caja.
            </p>
          </div>
        </div>

        {/* Formulario corporativo con campos limpios */}
        <form onSubmit={handleSubmit} className="space-y-5 p-7 sm:p-8">
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">mail</span>
              <span>Correo electrónico</span>
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
              placeholder="usuario@credit-on.com"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">key</span>
              <span>Contraseña</span>
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={mostrarPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
                title={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {mostrarPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 flex items-start gap-2.5 shadow-sm animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-rose-600 text-[18px] shrink-0 mt-0.5">error</span>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">
              {loading ? 'progress_activity' : 'lock_open'}
            </span>
            <span>{loading ? 'Validando credenciales…' : 'Ingresar al Sistema'}</span>
          </button>
        </form>

        <div className="bg-slate-50 border-t border-slate-100 px-8 py-3.5 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-600">Servidor Seguro Activo</span>
          </div>
          <span className="text-slate-400">CREDIT-ON v1.0</span>
        </div>
      </section>
    </main>
  );
}

export function AdminAccessGate({ children }: { children: ReactNode }): JSX.Element {
  const [access, setAccess] = useState<AccessState>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('credit_on_e2e_session') === 'admin') {
      return 'AUTHORIZED';
    }
    return 'CHECKING';
  });
  const [currentSession, setCurrentSession] = useState<Session | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('credit_on_e2e_session') === 'admin') {
      setAccess('AUTHORIZED');
      return;
    }

    if (!supabase) {
      setAccess('SIGNED_OUT');
      return;
    }

    let active = true;
    const updateAccess = async (session: Session | null) => {
      if (!active) return;
      setCurrentSession(session);

      if (typeof window !== 'undefined' && localStorage.getItem('credit_on_e2e_session') === 'admin') {
        setAccess('AUTHORIZED');
        return;
      }

      if (!session) {
        setAccess('SIGNED_OUT');
        return;
      }

      if (isAdmin(session)) {
        setAccess('AUTHORIZED');
        return;
      }

      if (isCobrador(session)) {
        setAccess('COBRADOR');
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
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-700 font-sans">
        <img
          src={logoCreditOn}
          alt="CREDIT-ON"
          className="w-14 h-14 rounded-2xl object-contain shadow-xl shadow-slate-900/20 border border-slate-200 animate-pulse bg-slate-900"
        />
        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Verificando credenciales de acceso…</span>
        </div>
      </main>
    );
  }


  if (access === 'COBRADOR') {
    const rawId =
      currentSession?.user.app_metadata?.id_cobrador ||
      currentSession?.user.user_metadata?.id_cobrador;
    const cobradorId = rawId ? Number(rawId) : 1;

    return (
      <CobradorPWA
        modoStandalone={true}
        cobradorIdInicial={cobradorId}
        onCerrarSesion={async () => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('credit_on_e2e_session');
          }
          if (supabase) await supabase.auth.signOut();
          setAccess('SIGNED_OUT');
        }}
      />
    );
  }

  if (access !== 'AUTHORIZED') {
    return (
      <AdminLoginScreen
        forbidden={access === 'FORBIDDEN'}
        onLoginSuccess={() => setAccess('AUTHORIZED')}
      />
    );
  }

  return <>{children}</>;
}
