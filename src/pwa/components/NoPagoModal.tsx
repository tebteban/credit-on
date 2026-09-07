import React, { useState } from 'react';
import { X, AlertCircle, Clock, Ban, Home, HelpCircle } from 'lucide-react';

interface NoPagoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string, notas?: string) => void;
  clienteNombre: string;
}

export const NoPagoModal: React.FC<NoPagoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  clienteNombre,
}) => {
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<string>('Cerrado');
  const [observacion, setObservacion] = useState<string>('');

  if (!isOpen) return null;

  const opciones = [
    { label: 'Cerrado', icon: Home, desc: 'Local o domicilio con persiana baja' },
    { label: 'No tenía dinero', icon: Ban, desc: 'Pidió que pase mañana sin falta' },
    { label: 'Pasar más tarde', icon: Clock, desc: 'Vuelve a pasar al final del circuito' },
    { label: 'Ausente', icon: HelpCircle, desc: 'No respondió al llamado o timbre' },
  ];

  const handleConfirmar = () => {
    onConfirm(motivoSeleccionado, observacion);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-md p-5 pb-8 sm:pb-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-amber-400">
              Registrar Visita Sin Cobro
            </div>
            <div className="font-bold text-base text-white truncate max-w-[280px]">
              {clienteNombre}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Opciones de 1 toque */}
        <div className="space-y-2">
          {opciones.map((op) => {
            const Icon = op.icon;
            const isSelected = motivoSeleccionado === op.label;
            return (
              <button
                key={op.label}
                type="button"
                onClick={() => setMotivoSeleccionado(op.label)}
                className={`w-full p-3.5 rounded-xl border text-left flex items-center gap-3 transition ${
                  isSelected
                    ? 'bg-amber-950/60 border-amber-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{op.label}</div>
                  <div className="text-xs text-slate-400">{op.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Nota adicional (opcional)</label>
          <input
            type="text"
            placeholder="Ej. Dejó dicho la empleada que cobra a las 18 hs"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          type="button"
          onClick={handleConfirmar}
          className="w-full h-13 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
        >
          <AlertCircle className="w-4 h-4" />
          <span>Confirmar Estado: {motivoSeleccionado}</span>
        </button>
      </div>
    </div>
  );
};
