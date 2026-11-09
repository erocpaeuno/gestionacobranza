import React, { useState } from 'react';
import { X, Building2, Phone, MapPin, User, Save, RotateCcw, Check } from 'lucide-react';
import { UsuarioConfig } from '../types';

interface ConfigModalProps {
  config: UsuarioConfig;
  onSave: (newConfig: UsuarioConfig) => void;
  onResetDatabase: () => void;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  config,
  onSave,
  onResetDatabase,
  onClose,
}) => {
  const [formData, setFormData] = useState<UsuarioConfig>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    if (window.confirm('¿Desea restaurar los datos iniciales de la base de datos? Se restablecerán clientes, préstamos y cuotas originales.')) {
      onResetDatabase();
      onClose();
    }
  };

  return (
    <div
      id="config-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm leading-tight">Configuración de la Empresa</h3>
              <p className="text-[11px] text-slate-400">Datos para recibos impresos y WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto grow space-y-3 text-xs">
          {savedSuccess && (
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl flex items-center gap-2 font-bold">
              <Check className="w-4 h-4" />
              ¡Configuración guardada correctamente!
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Nombre Comercial / Marca
            </label>
            <input
              type="text"
              required
              value={formData.nombre_marca}
              onChange={(e) => setFormData({ ...formData, nombre_marca: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-emerald-500"
              placeholder="Ej: FINANCIERA EL ÉXITO"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              Teléfono de Contacto / Soporte
            </label>
            <input
              type="text"
              value={formData.telefono || ''}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-emerald-500"
              placeholder="Ej: +51 987 654 321"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              Dirección Fiscal / Oficina
            </label>
            <input
              type="text"
              value={formData.direccion || ''}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-emerald-500"
              placeholder="Ej: Av. Principal 123, Of. 302"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Cobrador / Rep.
              </label>
              <input
                type="text"
                value={formData.representante || ''}
                onChange={(e) => setFormData({ ...formData, representante: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-emerald-500"
                placeholder="Nombre del cobrador"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                DNI Representante
              </label>
              <input
                type="text"
                value={formData.dni_representante || ''}
                onChange={(e) => setFormData({ ...formData, dni_representante: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-emerald-500"
                placeholder="DNI"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Guardar Configuración
            </button>
          </div>

          {/* Database Reset Action */}
          <div className="pt-4 mt-2 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer datos de prueba iniciales
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
