import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function SupabaseSessionControl(): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const iniciarSesion = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setPassword('');
    setOpen(false);
  };

  if (!isSupabaseConfigured) {
    return (
      <span className="hidden lg:inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Supabase sin configurar
      </span>
    );
  }

  if (session) {
    const role = String(session.user.app_metadata?.credit_on_role || 'sin rol');
    return (
      <div className="hidden md:flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {role}
        </span>
        <button
          type="button"
          onClick={() => supabase?.auth.signOut()}
          className="text-[11px] font-bold text-slate-500 hover:text-slate-900"
          title={`Cerrar sesión de ${session.user.email || 'Supabase'}`}
        >
          Salir
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-700"
      >
        Iniciar sesión
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <form onSubmit={iniciarSesion} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Acceso a CREDIT-ON</h2>
                <p className="mt-1 text-xs text-slate-500">Ingresá con el usuario creado en Supabase Auth.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-800">
                ×
              </button>
            </div>

            <label className="mb-3 block text-xs font-bold text-slate-700">
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500"
              />
            </label>

            {error && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Validando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
