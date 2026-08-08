import React from 'react';
import { Sparkles, GitBranch, Heart } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';

const VERSION = '0.1.4';

export const UpdatePanel: React.FC = () => {
  const openGitHub = async () => {
    try {
      await openUrl('https://github.com/sayghteight/culto-guieditor');
    } catch {
      window.open('https://github.com/sayghteight/culto-guieditor', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="max-w-4xl mx-auto pt-4">
      {/* Logo y versión */}
      <div className="flex flex-col items-center text-center mb-10">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-600 flex items-center justify-center mb-4 shadow-2xl shadow-amber-900/30">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          Aetheria
        </h1>
        <p className="text-slate-500 mt-1">Versión {VERSION}</p>
        <p className="text-xs text-slate-600 mt-1">Editor de mundos narrativos</p>
      </div>

      {/* Descripción */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-xl mb-4">
        <h3 className="font-semibold text-slate-200 mb-3">¿Qué es Aetheria?</h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          Aetheria es un editor pensado para escritores que trabajan con mundos complejos: múltiples líneas temporales, calendarios personalizados, escenas interconectadas y un universo narrativo en constante expansión. Permite organizar, escribir y visualizar tu mundo ficticio desde un único espacio centralizado.
        </p>
      </div>

      {/* Características */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {[
          { label: 'Manuscrito digital', desc: 'Edita y organiza escenas con un editor rico en formato.' },
          { label: 'Universo narrativo', desc: 'Gestiona personajes, locaciones, tramas y eventos.' },
          { label: 'Línea temporal', desc: 'Visualiza eventos en una cronología interactiva.' },
          { label: 'Calendarios personalizados', desc: 'Crea calendarios ficticios con meses, semanas y estaciones.' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
            <p className="font-semibold text-slate-200 text-sm">{item.label}</p>
            <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Créditos y enlaces */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-xl mb-4">
        <h3 className="font-semibold text-slate-200 mb-3">Créditos</h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          Aetheria está desarrollado y mantenido por{' '}
          <span className="text-slate-200 font-medium">sayghteight</span>. Construido con Tauri, React, Lexical y mucho café.
        </p>
        <button
          onClick={() => void openGitHub()}
          className="inline-flex items-center gap-2 mt-4 rounded-lg bg-slate-950 border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-amber-500 hover:text-white"
        >
          <GitBranch className="w-4 h-4" />
          Ver en GitHub
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 pt-2">
        <Heart className="w-3 h-3 text-fuchsia-500" />
        <span>Hecho con propósito narrativo</span>
      </div>
    </div>
  );
};
