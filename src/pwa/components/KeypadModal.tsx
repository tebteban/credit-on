import React, { useState } from 'react';
import { Delete, X, Check, DollarSign } from 'lucide-react';

interface KeypadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (monto: number) => void;
  clienteNombre: string;
  cuotaDiaria: number;
}

export const KeypadModal: React.FC<KeypadModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  clienteNombre,
  cuotaDiaria,
}) => {
  const [valorStr, setValorStr] = useState<string>('');

  if (!isOpen) return null;

  const handleNumero = (num: string) => {
    if (valorStr.length >= 8) return;
    setValorStr((prev) => (prev === '0' ? num : prev + num));
  };

  const handleBorrar = () => {
    setValorStr((prev) => prev.slice(0, -1));
  };

  const handleLimpiar = () => {
    setValorStr('');
  };

  const handleConfirmar = () => {
    const val = parseFloat(valorStr);
    if (!val || val <= 0) {
      alert('Ingrese un monto válido');
      return;
    }
    onConfirm(val);
    setValorStr('');
    onClose();
  };

  const valorNum = parseFloat(valorStr) || 0;
  const equivalencia = cuotaDiaria > 0 ? (valorNum / cuotaDiaria).toFixed(2) : '0';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-2xl w-full max-w-md p-5 pb-8 sm:pb-5 space-y-4 shadow-2xl">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-700">
              Ingreso de Pago Especial
            </div>
            <div className="font-bold text-base text-slate-900 truncate max-w-[280px]">
              {clienteNombre}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display del Monto */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
          <div className="text-xs text-slate-500 font-medium">Monto a Cobrar:</div>
          <div className="text-4xl font-extrabold font-mono text-emerald-700 mt-1 flex items-center justify-center gap-1">
            <span className="text-2xl text-emerald-600">$</span>
            <span>{valorNum > 0 ? valorNum.toLocaleString('es-AR') : '0'}</span>
          </div>
          {valorNum > 0 && (
            <div className="text-xs text-slate-500 mt-1 font-mono">
              Equivale a <span className="font-bold text-slate-800">{equivalencia}</span> cuota(s) de $
              {cuotaDiaria.toLocaleString('es-AR')}
            </div>
          )}
        </div>

        {/* Botones de sugerencia rápida */}
        <div className="grid grid-cols-3 gap-2 text-xs font-mono font-bold">
          <button
            onClick={() => setValorStr(String(cuotaDiaria * 0.5))}
            className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition"
          >
            1/2 Cuota
          </button>
          <button
            onClick={() => setValorStr(String(cuotaDiaria * 2))}
            className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition"
          >
            2 Cuotas
          </button>
          <button
            onClick={() => setValorStr(String(cuotaDiaria * 3))}
            className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition"
          >
            3 Cuotas
          </button>
        </div>

        {/* Teclado Numérico Táctil Grande */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button
              key={n}
              onClick={() => handleNumero(n)}
              className="h-14 bg-white hover:bg-slate-50 border border-slate-200 active:scale-95 text-2xl font-mono font-bold text-slate-800 rounded-xl transition flex items-center justify-center shadow-sm"
            >
              {n}
            </button>
          ))}

          <button
            onClick={handleLimpiar}
            className="h-14 bg-slate-50 hover:bg-slate-100 border border-slate-200 active:scale-95 text-sm font-bold text-amber-700 rounded-xl transition flex items-center justify-center"
          >
            C
          </button>

          <button
            onClick={() => handleNumero('0')}
            className="h-14 bg-white hover:bg-slate-50 border border-slate-200 active:scale-95 text-2xl font-mono font-bold text-slate-800 rounded-xl transition flex items-center justify-center shadow-sm"
          >
            0
          </button>

          <button
            onClick={handleBorrar}
            className="h-14 bg-slate-50 hover:bg-slate-100 border border-slate-200 active:scale-95 text-slate-600 rounded-xl transition flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Botón Confirmar Cobro */}
        <button
          onClick={handleConfirmar}
          disabled={valorNum <= 0}
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-base rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-98"
        >
          <Check className="w-6 h-6" />
          <span>Confirmar Cobro de ${valorNum.toLocaleString('es-AR')}</span>
        </button>
      </div>
    </div>
  );
};
