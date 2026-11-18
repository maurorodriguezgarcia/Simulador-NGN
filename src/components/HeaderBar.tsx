import React from 'react';
import {
  Activity,
  Bot,
  Building2,
  Edit3,
  GitBranch,
  Layers,
  Moon,
  Network,
  RotateCcw,
  Sliders,
  Sun,
  Table2,
  Terminal,
} from 'lucide-react';
import {
  InfraDesign,
  InfraPresetId,
  MainTabId,
  SiteNode,
  ThemeMode,
  WanArchitecture,
} from '../types/network';
import { PRESET_LABELS, WAN_LABELS } from '../data/presets';

interface HeaderBarProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  wanArch: WanArchitecture;
  onChangeWanArch: (arch: WanArchitecture) => void;
  presetId: InfraPresetId;
  onChangePreset: (preset: InfraPresetId) => void;
  liveSlaPct: number;
  onResetAll: () => void;
  activeTab: MainTabId;
  onChangeTab: (tab: MainTabId) => void;
  design: InfraDesign;
  sitesInSla: number;
  totalSites: number;
  activeHour: number;
  sedeA: SiteNode;
  sedeB: SiteNode;
  sedeC: SiteNode;
  onOpenCopilot: () => void;
}

const TABS: { id: MainTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'simulacion', label: 'Simulación', icon: Activity },
  { id: 'diseno', label: 'Diseño paramétrico', icon: Sliders },
  { id: 'convergencia', label: 'Modelo de convergencia NGN', icon: Layers },
  { id: 'cli', label: 'Configuración CLI', icon: Terminal },
  { id: 'matriz', label: 'Matriz de transporte WAN', icon: Table2 },
];

export const HeaderBar: React.FC<HeaderBarProps> = ({
  theme,
  onToggleTheme,
  wanArch,
  onChangeWanArch,
  presetId,
  onChangePreset,
  liveSlaPct,
  onResetAll,
  activeTab,
  onChangeTab,
  design,
  sitesInSla,
  totalSites,
  activeHour,
  sedeA,
  sedeB,
  sedeC,
  onOpenCopilot,
}) => {
  const hourStr = `${String(activeHour).padStart(2, '0')}:00`;
  const slaHealthy = liveSlaPct >= 99.5 && sitesInSla === totalSites;

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-300/80 dark:border-slate-800 shadow-xs transition-colors">
      {/* Main Header Row */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-3.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-900 dark:bg-sky-600 text-white flex items-center justify-center shrink-0">
              <Network className="w-4.5 h-4.5 text-sky-400 dark:text-white" />
            </div>
            <h1 className="font-display text-2xl lg:text-[26px] font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              Simulador NGN: servicios de borde, VPN, MPLS y QoS
            </h1>
          </div>
          <p className="mt-1.5 text-xs lg:text-[13px] text-slate-600 dark:text-slate-300 max-w-3xl leading-snug">
            Plataforma ISP de ingeniería y operación para servicios de borde (DHCP relay, HSRP, PPP/PPPoE, NAT/CGNAT),
            túneles GRE/IPsec, MPLS L3VPN, GPON FTTH y calidad de servicio QoS DiffServ.
          </p>
        </div>

        {/* Right-Side Global Controls + Theme Switcher */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Segmented 1: Arquitectura WAN */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none">
              Arquitectura WAN
            </span>
            <div
              role="group"
              aria-label="Arquitectura WAN"
              className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
            >
              {(['metroethernet', 'mpls', 'gpon'] as WanArchitecture[]).map((arch) => {
                const active = wanArch === arch;
                return (
                  <button
                    key={arch}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChangeWanArch(arch)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-sky-600 dark:text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {WAN_LABELS[arch]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Segmented 2: Infraestructura base */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none">
              Infraestructura base
            </span>
            <div
              role="group"
              aria-label="Infraestructura base"
              className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
            >
              {(['universidad', 'empresa', 'operador'] as InfraPresetId[]).map((pid) => {
                const active = presetId === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChangePreset(pid)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-sky-700 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {PRESET_LABELS[pid]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control 3: Live SLA indicator + quick reset + Dark Mode Toggle */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none">
                SLA objetivo medido en vivo
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`font-display text-xl font-bold tabular-nums leading-none ${
                    slaHealthy
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {liveSlaPct.toFixed(3)} %
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    slaHealthy
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {slaHealthy ? 'NOMINAL' : 'DEGRADADO'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onResetAll}
              title="Reiniciar simulación y parámetros al valor nominal"
              aria-label="Reiniciar simulación"
              className="p-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline">Oscuro</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 5 Navigation Tabs */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 flex items-center justify-between gap-2 overflow-x-auto">
          <nav className="flex items-center gap-1" aria-label="Vistas principales">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onChangeTab(tab.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    active
                      ? 'border-sky-700 dark:border-sky-400 text-sky-900 dark:text-white bg-white dark:bg-slate-900'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active ? 'text-sky-700 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={onOpenCopilot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1 rounded-md bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-sky-400 dark:text-white" />
            <span>Copiloto NOC ISP</span>
          </button>
        </div>
      </div>

      {/* Horizontal Contextual Status Bar */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/70">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-300">
            <Building2 className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white">{design.orgName}</span>
            <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">·</span>
            <span>{design.summaryTag}</span>
            <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">·</span>
            <span className="tabular-nums font-medium">{totalSites} sedes</span>
            <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">·</span>
            <span
              className={`tabular-nums font-semibold ${
                sitesInSla === totalSites
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {sitesInSla} de {totalSites} dentro del SLA a las {hourStr}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <GitBranch className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>
                <strong className="text-slate-800 dark:text-white">Sede A:</strong> {sedeA.city}
              </span>
              <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">/</span>
              <span>
                <strong className="text-slate-800 dark:text-white">Sede B:</strong> {sedeB.city}
              </span>
              <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">/</span>
              <span>
                <strong className="text-slate-800 dark:text-white">Sede C:</strong> {sedeC.city}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onChangeTab('diseno')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:text-sky-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar el diseño</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
