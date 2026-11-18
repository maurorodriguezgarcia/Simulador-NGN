import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  BookmarkCheck,
  CheckCircle2,
  DollarSign,
  FileCheck2,
  GitCompare,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Printer,
  Radio,
  Router,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  BaselineSnapshot,
  DesignValidationIssue,
  FaultInjection,
  GponOpticalClass,
  GponSplitterRatio,
  InfraDesign,
  InfraPresetId,
  N1ContingencyScenario,
  OpexEstimate,
  SiteHourlyMetrics,
  SiteNode,
  ThemeMode,
  WanArchitecture,
} from '../types/network';
import {
  COLOMBIA_MAP_SVG_PATH,
  COLOMBIAN_CITIES,
  PRESET_LABELS,
  WAN_LABELS,
} from '../data/presets';
import { calculateCgnatOffload, calculateDesignVlsm } from '../engine/vlsm';
import { generateSiteRouterCli } from '../engine/cliGenerator';

interface ParametricDesignTabProps {
  theme: ThemeMode;
  design: InfraDesign;
  onChangePreset: (preset: InfraPresetId) => void;
  onUpdateDesign: (updater: (prev: InfraDesign) => InfraDesign) => void;
  activeHour: number;
  onChangeHour: (h: number) => void;
  faults: FaultInjection;
  onChangeFaults: (updater: (prev: FaultInjection) => FaultInjection) => void;
  evaluation: {
    siteMetrics: SiteHourlyMetrics[];
    globalSlaPct: number;
    sitesInSla: number;
    totalSites: number;
    totalDemandMbps: number;
    totalCapacityMbps: number;
    peakHour: number;
    avgLatencyMs: number;
    validations: DesignValidationIssue[];
    n1Matrix: N1ContingencyScenario[];
    opex: OpexEstimate;
  };
  baseline: BaselineSnapshot | null;
  onSaveBaseline: () => void;
  onClearBaseline: () => void;
}

type SubView =
  | 'topologia'
  | 'direccionamiento'
  | 'resiliencia'
  | 'configuraciones'
  | 'validaciones'
  | 'acta';

export const ParametricDesignTab: React.FC<ParametricDesignTabProps> = ({
  theme,
  design,
  onChangePreset,
  onUpdateDesign,
  activeHour,
  onChangeHour,
  faults,
  onChangeFaults,
  evaluation,
  baseline,
  onSaveBaseline,
  onClearBaseline,
}) => {
  const isDark = theme === 'dark';
  const [subView, setSubView] = useState<SubView>('topologia');
  const [mapColorMode, setMapColorMode] = useState<'technology' | 'utilization'>('technology');
  const [selectedSiteId, setSelectedSiteId] = useState<string>(
    design.sites[1]?.id || design.sites[0]?.id || ''
  );
  const [isPlayingDay, setIsPlayingDay] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [cliTechFilter, setCliTechFilter] = useState<'all' | WanArchitecture>('all');
  const [newCityName, setNewCityName] = useState<string>('Cúcuta');
  const [newSiteTech, setNewSiteTech] = useState<WanArchitecture>('mpls');
  const [newSiteCap, setNewSiteCap] = useState<number>(250);
  const [newSiteUsers, setNewSiteUsers] = useState<number>(220);
  const [newSiteSplitter, setNewSiteSplitter] = useState<GponSplitterRatio>('1:32');
  const [newSiteOpticalClass, setNewSiteOpticalClass] = useState<GponOpticalClass>('B+');
  const [newSiteDistanceKm, setNewSiteDistanceKm] = useState<number>(14);

  useEffect(() => {
    if (!design.sites.some((s) => s.id === selectedSiteId)) {
      setSelectedSiteId(design.sites[1]?.id || design.sites[0]?.id || '');
    }
  }, [design.sites, selectedSiteId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMapFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!isPlayingDay) return;
    const timer = setInterval(() => {
      onChangeHour((activeHour + 1) % 24);
    }, 650);
    return () => clearInterval(timer);
  }, [isPlayingDay, activeHour, onChangeHour]);

  const vlsmRows = useMemo(() => calculateDesignVlsm(design), [design]);
  const cgnatSummary = useMemo(() => calculateCgnatOffload(design), [design]);

  const siteConfigs = useMemo(() => {
    return design.sites
      .filter((s) => cliTechFilter === 'all' || s.technology === cliTechFilter)
      .map((s) => generateSiteRouterCli(s, design));
  }, [design, cliTechFilter]);

  const [selectedCliSiteId, setSelectedCliSiteId] = useState<string>(design.sites[0]?.id || '');
  const activeCliConfig = siteConfigs.find((c) => c.id === selectedCliSiteId) || siteConfigs[0];

  const selectedSite = design.sites.find((s) => s.id === selectedSiteId) || design.sites[0];
  const selectedMetric =
    evaluation.siteMetrics.find((m) => m.siteId === selectedSite?.id) || evaluation.siteMetrics[0];

  const hubSite = design.sites.find((s) => s.isPrimaryHub) || design.sites[0];

  const handleAddSite = () => {
    const cityObj = COLOMBIAN_CITIES.find((c) => c.city === newCityName) || COLOMBIAN_CITIES[0];
    const nextIdx = design.sites.length + 1;
    const newSite: SiteNode = {
      id: `site-${Date.now().toString(36)}`,
      name: `Sede ${cityObj.city}`,
      city: cityObj.city,
      region: cityObj.region,
      mapX: cityObj.mapX,
      mapY: cityObj.mapY,
      role: 'regional',
      technology: newSiteTech,
      capacityMbps: newSiteCap,
      users: newSiteUsers,
      devices: Math.round(newSiteUsers * 1.35),
      vlanBase: 100 + nextIdx * 10,
      subnetOctet: 10 + nextIdx * 10,
      splitterRatio: newSiteTech === 'gpon' ? newSiteSplitter : undefined,
      gponOpticalClass: newSiteTech === 'gpon' ? newSiteOpticalClass : undefined,
      distanceKm: newSiteTech === 'gpon' ? newSiteDistanceKm : cityObj.distanceKm,
    };
    onUpdateDesign((prev) => ({
      ...prev,
      sites: [...prev.sites, newSite],
    }));
    setSelectedSiteId(newSite.id);
  };

  const handleDeleteSite = (id: string) => {
    if (design.sites.length <= 3) return;
    onUpdateDesign((prev) => ({
      ...prev,
      sites: prev.sites.filter((s) => s.id !== id),
    }));
  };

  const handleUpdateSiteField = <K extends keyof SiteNode>(id: string, key: K, val: SiteNode[K]) => {
    onUpdateDesign((prev) => ({
      ...prev,
      sites: prev.sites.map((s) => (s.id === id ? { ...s, [key]: val } : s)),
    }));
  };

  const getSiteColor = (site: SiteNode, metric?: SiteHourlyMetrics) => {
    if (metric?.status === 'down') return '#DC2626';
    if (mapColorMode === 'technology') {
      if (site.technology === 'metroethernet') return '#0284C7';
      if (site.technology === 'mpls') return '#7C3AED';
      return '#059669';
    }
    const util = metric?.utilizationPct ?? 0;
    if (util >= 90) return '#DC2626';
    if (util >= 72) return '#D97706';
    return '#059669';
  };

  const totalUsers = design.sites.reduce((a, s) => a + s.users, 0);
  const totalDevices = design.sites.reduce((a, s) => a + s.devices, 0);

  const renderColombiaMapSvg = (large = false) => (
    <svg
      viewBox="0 0 360 440"
      className={`w-full mx-auto block ${large ? 'max-h-[76vh]' : 'max-h-[380px]'}`}
    >
      <defs>
        <filter id="cityGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d={COLOMBIA_MAP_SVG_PATH}
        fill={isDark ? '#111C31' : '#EFF4FA'}
        stroke={isDark ? '#475569' : '#94A3B8'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {hubSite &&
        design.sites
          .filter((s) => s.id !== hubSite.id)
          .map((site) => {
            const m = evaluation.siteMetrics.find((x) => x.siteId === site.id);
            const col = getSiteColor(site, m);
            const isDown = m?.status === 'down';
            const loadRatio = Math.min(1, (m?.utilizationPct || 20) / 100);
            const durSec = Math.max(0.7, 2.4 - loadRatio * 1.5);

            return (
              <g key={`link-${site.id}`}>
                <line
                  x1={hubSite.mapX}
                  y1={hubSite.mapY}
                  x2={site.mapX}
                  y2={site.mapY}
                  stroke={isDown ? '#EF4444' : col}
                  strokeWidth={selectedSiteId === site.id ? 2.4 : 1.4}
                  strokeOpacity={isDown ? 0.6 : 0.55}
                  strokeDasharray={isDown ? '4 4' : undefined}
                />
                {!isDown && (
                  <circle r={2.5 + loadRatio * 1.8} fill={col}>
                    <animateMotion
                      dur={`${durSec.toFixed(2)}s`}
                      repeatCount="indefinite"
                      path={`M${site.mapX},${site.mapY} L${hubSite.mapX},${hubSite.mapY}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}

      {design.sites.map((site) => {
        const m = evaluation.siteMetrics.find((x) => x.siteId === site.id);
        const col = getSiteColor(site, m);
        const isSelected = selectedSiteId === site.id;

        return (
          <g
            key={site.id}
            transform={`translate(${site.mapX}, ${site.mapY})`}
            onClick={() => setSelectedSiteId(site.id)}
            className="cursor-pointer"
          >
            {isSelected && (
              <circle
                r="11"
                fill="none"
                stroke={isDark ? '#F8FAFC' : '#0F172A'}
                strokeWidth="1.6"
                strokeDasharray="3 2"
              />
            )}
            <circle
              r={site.isPrimaryHub ? 7.5 : 5.5}
              fill={col}
              stroke={isDark ? '#0F172A' : '#FFFFFF'}
              strokeWidth="1.6"
              filter={site.isPrimaryHub ? 'url(#cityGlow)' : undefined}
            />
            <text
              x="9"
              y="3"
              fontSize="8.5"
              fontWeight={isSelected || site.isPrimaryHub ? '700' : '600'}
              fill={isDark ? '#E2E8F0' : '#0F172A'}
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {site.city.replace(' D.C.', '')}
            </text>
          </g>
        );
      })}
    </svg>
  );

  // ITU-T Y.1564 Certification Data
  const y1564Classes = useMemo(() => {
    const totalCap = evaluation.totalCapacityMbps;
    const qos = design.policies.qosEnabled;
    return [
      {
        cls: 'EF (DSCP 46) · Voz / Telemedicina',
        cirMbps: Math.round(totalCap * 0.25),
        eirMbps: 0,
        cbsKb: 64,
        ebsKb: 0,
        ftdMs: `${Math.min(design.policies.slaLatencyVoiceMs - 6, evaluation.avgLatencyMs).toFixed(1)} ms`,
        fdvMs: qos ? '1.4 ms' : '7.8 ms',
        flrPct: qos ? '0.00%' : '0.45%',
        pass: qos && evaluation.avgLatencyMs <= design.policies.slaLatencyVoiceMs,
      },
      {
        cls: 'AF41 (DSCP 34) · Video / Telepresencia',
        cirMbps: Math.round(totalCap * 0.30),
        eirMbps: Math.round(totalCap * 0.05),
        cbsKb: 256,
        ebsKb: 128,
        ftdMs: `${(evaluation.avgLatencyMs + 2.1).toFixed(1)} ms`,
        fdvMs: qos ? '2.8 ms' : '11.4 ms',
        flrPct: qos ? '0.02%' : '0.80%',
        pass: qos,
      },
      {
        cls: 'AF31/AF21 · Datos Corporativos / ERP',
        cirMbps: Math.round(totalCap * 0.25),
        eirMbps: Math.round(totalCap * 0.15),
        cbsKb: 512,
        ebsKb: 256,
        ftdMs: `${(evaluation.avgLatencyMs + 5.4).toFixed(1)} ms`,
        fdvMs: qos ? '4.5 ms' : '15.2 ms',
        flrPct: qos ? '0.04%' : '1.15%',
        pass: true,
      },
      {
        cls: 'BE (DSCP 0) · Navegación / Best Effort',
        cirMbps: Math.round(totalCap * 0.10),
        eirMbps: Math.round(totalCap * 0.30),
        cbsKb: 256,
        ebsKb: 512,
        ftdMs: `${(evaluation.avgLatencyMs + 14.0).toFixed(1)} ms`,
        fdvMs: '18.0 ms',
        flrPct: '0.25% (WRED)',
        pass: true,
      },
    ];
  }, [evaluation, design.policies]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4 grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      {/* Fullscreen Map Modal */}
      {isMapFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mapa geográfico nacional en pantalla completa"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs p-4 lg:p-6 flex flex-col no-print"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl flex-1 flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Mapa Geográfico Nacional Colombia · {design.orgName}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {design.sites.length} sedes · {String(activeHour).padStart(2, '0')}:00 h · Demanda{' '}
                  {evaluation.totalDemandMbps.toFixed(0)} / {evaluation.totalCapacityMbps} Mbps
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMapFullscreen(false)}
                aria-label="Cerrar mapa en pantalla completa"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Cerrar</span>
              </button>
            </div>
            <div className="flex-1 bg-dot-grid flex items-center justify-center p-4 overflow-auto">
              {renderColombiaMapSvg(true)}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          LEFT PANEL: Templates, Org Name, Policies, App Demands, Site CRUD
         =================================================================== */}
      <aside className="xl:col-span-3 flex flex-col gap-3.5 no-print">
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Parámetros de infraestructura
          </h2>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Plantilla empresarial
            </label>
            <div className="grid grid-cols-1 gap-1">
              {(['universidad', 'empresa', 'operador'] as InfraPresetId[]).map((pid) => (
                <button
                  key={pid}
                  type="button"
                  aria-pressed={design.presetId === pid}
                  onClick={() => onChangePreset(pid)}
                  className={`px-2.5 py-1.5 rounded-md border text-xs font-semibold text-left cursor-pointer transition-colors ${
                    design.presetId === pid
                      ? 'bg-sky-700 border-sky-700 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {PRESET_LABELS[pid]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Nombre de la organización
            </label>
            <input
              type="text"
              value={design.orgName}
              onChange={(e) =>
                onUpdateDesign((prev) => ({ ...prev, orgName: e.target.value }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
            />
          </div>
        </section>

        {/* Políticas del Núcleo + IPv6 Dual-Stack */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs space-y-2.5 text-xs">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Políticas del núcleo e IPv6
          </h3>

          {[
            { key: 'qosEnabled' as const, label: 'QoS DiffServ (LLQ + CBWFQ + WRED)' },
            { key: 'ipsecOnGpon' as const, label: 'Cifrado IPsec GRE en sedes GPON' },
            { key: 'hsrpEnabled' as const, label: 'HSRP sub-segundo (250/750 ms)' },
            { key: 'frrEnabled' as const, label: 'MPLS TE Fast Reroute (<50 ms)' },
          ].map((pol) => (
            <label key={pol.key} className="flex items-center justify-between gap-2 py-1 cursor-pointer">
              <span className="text-slate-700 dark:text-slate-300 font-medium">{pol.label}</span>
              <input
                type="checkbox"
                checked={design.policies[pol.key]}
                onChange={(e) =>
                  onUpdateDesign((p) => ({
                    ...p,
                    policies: { ...p.policies, [pol.key]: e.target.checked },
                  }))
                }
                className="accent-sky-700 w-4 h-4"
              />
            </label>
          ))}

          {/* Adopción IPv6 Slider */}
          <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1">
              <span className="font-medium">Adopción Dual-Stack IPv6</span>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                {design.policies.ipv6AdoptionPct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={70}
              step={5}
              value={design.policies.ipv6AdoptionPct}
              onChange={(e) =>
                onUpdateDesign((p) => ({
                  ...p,
                  policies: { ...p.policies, ipv6AdoptionPct: Number(e.target.value) },
                }))
              }
              className="w-full accent-sky-700"
            />
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Descarga CGNAT: -{cgnatSummary.publicIpsSaved} IPs públicas ({cgnatSummary.remainingIpv4Sessions.toLocaleString()} sesiones IPv4)
            </div>
          </div>

          <div className="pt-1">
            <label className="block text-slate-600 dark:text-slate-400 mb-1">Salida a Internet</label>
            <div className="grid grid-cols-2 gap-1">
              {(['central', 'local'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={design.policies.internetExit === mode}
                  onClick={() =>
                    onUpdateDesign((p) => ({
                      ...p,
                      policies: { ...p.policies, internetExit: mode },
                    }))
                  }
                  className={`py-1 rounded border font-semibold cursor-pointer ${
                    design.policies.internetExit === mode
                      ? 'bg-slate-900 dark:bg-sky-600 border-slate-900 dark:border-sky-500 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {mode === 'central' ? 'Central (DC)' : 'Local (Sede)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                Relación CGNAT
              </label>
              <select
                value={design.policies.cgnatRatio}
                onChange={(e) =>
                  onUpdateDesign((p) => ({
                    ...p,
                    policies: { ...p.policies, cgnatRatio: Number(e.target.value) as 16 | 32 | 64 },
                  }))
                }
                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-slate-900 dark:text-slate-100"
              >
                <option value={16}>16 : 1</option>
                <option value={32}>32 : 1</option>
                <option value={64}>64 : 1</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                SLA Latencia Voz (ms)
              </label>
              <input
                type="number"
                min={15}
                max={120}
                value={design.policies.slaLatencyVoiceMs}
                onChange={(e) =>
                  onUpdateDesign((p) => ({
                    ...p,
                    policies: {
                      ...p.policies,
                      slaLatencyVoiceMs: Math.max(10, Number(e.target.value)),
                    },
                  }))
                }
                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </section>

        {/* Demanda por Aplicación */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs space-y-2.5 text-xs">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Demanda por aplicación (kbps / usuario)
          </h3>
          {[
            { key: 'voiceKbpsPerUser' as const, label: 'Voz / Telemedicina (EF)', min: 8, max: 128 },
            { key: 'videoKbpsPerUser' as const, label: 'Videoconferencia (AF41)', min: 40, max: 600 },
            { key: 'erpKbpsPerUser' as const, label: 'ERP / Académico (AF21)', min: 20, max: 400 },
            { key: 'webKbpsPerUser' as const, label: 'Web / Cloud (BE)', min: 30, max: 500 },
          ].map((app) => (
            <div key={app.key}>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-0.5">
                <span>{app.label}</span>
                <span className="font-mono font-bold tabular-nums">
                  {design.appDemands[app.key]} kbps
                </span>
              </div>
              <input
                type="range"
                min={app.min}
                max={app.max}
                step={5}
                value={design.appDemands[app.key]}
                onChange={(e) =>
                  onUpdateDesign((p) => ({
                    ...p,
                    appDemands: { ...p.appDemands, [app.key]: Number(e.target.value) },
                  }))
                }
                className="w-full accent-sky-700"
              />
            </div>
          ))}
        </section>

        {/* Agregar Sede en Colombia */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs space-y-2.5 text-xs">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Agregar sede regional (Colombia)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Ciudad</label>
              <select
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              >
                {COLOMBIAN_CITIES.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                Tecnología WAN
              </label>
              <select
                value={newSiteTech}
                onChange={(e) => setNewSiteTech(e.target.value as WanArchitecture)}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              >
                <option value="metroethernet">MetroEthernet</option>
                <option value="mpls">MPLS L3VPN</option>
                <option value="gpon">GPON FTTH</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                Capacidad (Mbps)
              </label>
              <input
                type="number"
                min={50}
                max={5000}
                step={50}
                value={newSiteCap}
                onChange={(e) => setNewSiteCap(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Usuarios</label>
              <input
                type="number"
                min={20}
                max={5000}
                step={20}
                value={newSiteUsers}
                onChange={(e) => setNewSiteUsers(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>

            {newSiteTech === 'gpon' && (
              <>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Splitter / Clase ODN
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <select
                      value={newSiteSplitter}
                      onChange={(e) => setNewSiteSplitter(e.target.value as GponSplitterRatio)}
                      className="px-1.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono"
                    >
                      <option value="1:8">1:8</option>
                      <option value="1:16">1:16</option>
                      <option value="1:32">1:32</option>
                      <option value="1:64">1:64</option>
                    </select>
                    <select
                      value={newSiteOpticalClass}
                      onChange={(e) => setNewSiteOpticalClass(e.target.value as GponOpticalClass)}
                      className="px-1.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono"
                    >
                      <option value="B+">B+</option>
                      <option value="C+">C+</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Fibra ODN (km)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    step={1}
                    value={newSiteDistanceKm}
                    onChange={(e) => setNewSiteDistanceKm(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono tabular-nums"
                  />
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddSite}
            className="w-full py-1.5 px-3 bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white rounded-md font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar sede al diseño</span>
          </button>
        </section>
      </aside>

      {/* ===================================================================
          CENTER PANEL: 6 Subviews
         =================================================================== */}
      <section className="xl:col-span-6 flex flex-col gap-3.5 print-full-width">
        <div className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg overflow-hidden shadow-xs">
          {/* Subview Tabs */}
          <div className="px-4 pt-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/60 no-print">
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'topologia', label: 'Topología' },
                { id: 'direccionamiento', label: 'Direccionamiento / IPv6' },
                { id: 'resiliencia', label: 'Resiliencia N-1' },
                { id: 'configuraciones', label: 'Configuraciones' },
                { id: 'validaciones', label: `Validaciones (${evaluation.validations.length})` },
                { id: 'acta', label: 'Acta SLA / Entregable' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={subView === t.id}
                  onClick={() => setSubView(t.id as SubView)}
                  className={`px-2.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    subView === t.id
                      ? 'border-sky-700 dark:border-sky-400 text-sky-900 dark:text-white bg-white dark:bg-slate-900 rounded-t'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {subView === 'topologia' && (
              <div className="flex items-center gap-1 pb-2">
                <button
                  type="button"
                  aria-pressed={mapColorMode === 'technology'}
                  onClick={() => setMapColorMode('technology')}
                  className={`px-2 py-1 text-[11px] font-semibold rounded border cursor-pointer ${
                    mapColorMode === 'technology'
                      ? 'bg-slate-900 dark:bg-sky-600 text-white border-slate-900 dark:border-sky-500'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Por tecnología
                </button>
                <button
                  type="button"
                  aria-pressed={mapColorMode === 'utilization'}
                  onClick={() => setMapColorMode('utilization')}
                  className={`px-2 py-1 text-[11px] font-semibold rounded border cursor-pointer ${
                    mapColorMode === 'utilization'
                      ? 'bg-slate-900 dark:bg-sky-600 text-white border-slate-900 dark:border-sky-500'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Por nivel de uso
                </button>
              </div>
            )}
          </div>

          {/* SUBVIEW 1: TOPOLOGÍA */}
          {subView === 'topologia' && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                {/* Colombia Map */}
                <div className="lg:col-span-7 bg-dot-grid border border-slate-200 dark:border-slate-700 rounded-lg p-2 relative">
                  <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                    <span>Mapa nacional Colombia · {String(activeHour).padStart(2, '0')}:00 h</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sky-800 dark:text-sky-400">
                        {design.sites.length} nodos
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsMapFullscreen(true)}
                        aria-label="Expandir mapa geográfico"
                        title="Expandir mapa geográfico"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {renderColombiaMapSvg(false)}

                  <div className="px-2 pb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    {mapColorMode === 'technology' ? (
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" /> MetroE
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block" /> MPLS
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> GPON
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> &lt;72%
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" /> 72–90%
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" /> ≥90% / Caído
                        </span>
                      </div>
                    )}
                    <span className="text-slate-500 dark:text-slate-400">Clic en nodo para editar</span>
                  </div>
                </div>

                {/* Right Diagram: Red Metropolitana / Datacenter */}
                <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-2">
                      Red Metropolitana y Datacenter Central
                    </div>
                    <svg viewBox="0 0 240 310" className="w-full h-auto block">
                      <rect
                        x="65"
                        y="10"
                        width="110"
                        height="32"
                        rx="16"
                        fill={
                          faults.centralInternetDown
                            ? '#FEE2E2'
                            : isDark
                            ? '#0C4A6E'
                            : '#E0F2FE'
                        }
                        stroke={faults.centralInternetDown ? '#DC2626' : '#0284C7'}
                        strokeWidth="1.4"
                      />
                      <text
                        x="120"
                        y="30"
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="700"
                        fill={
                          faults.centralInternetDown
                            ? '#B91C1C'
                            : isDark
                            ? '#E0F2FE'
                            : '#0369A1'
                        }
                      >
                        {faults.centralInternetDown ? 'INTERNET CAÍDO' : 'INTERNET / IXP'}
                      </text>

                      <line x1="100" y1="42" x2="72" y2="78" stroke="#64748B" strokeWidth="1.5" />
                      <line x1="140" y1="42" x2="168" y2="78" stroke="#64748B" strokeWidth="1.5" />

                      <circle
                        cx="72"
                        cy="94"
                        r="18"
                        fill={faults.primaryRouterDown ? '#FEE2E2' : '#0F172A'}
                        stroke={faults.primaryRouterDown ? '#DC2626' : '#0284C7'}
                        strokeWidth="1.8"
                      />
                      <text
                        x="72"
                        y="97"
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="700"
                        fill={faults.primaryRouterDown ? '#B91C1C' : '#FFFFFF'}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        R-DC-A
                      </text>

                      <circle
                        cx="168"
                        cy="94"
                        r="18"
                        fill="#0F172A"
                        stroke={
                          faults.primaryRouterDown && design.policies.hsrpEnabled
                            ? '#10B981'
                            : '#64748B'
                        }
                        strokeWidth="1.8"
                      />
                      <text
                        x="168"
                        y="97"
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="700"
                        fill="#FFFFFF"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        R-DC-B
                      </text>

                      <line
                        x1="90"
                        y1="94"
                        x2="150"
                        y2="94"
                        stroke="#0284C7"
                        strokeWidth="1.4"
                        strokeDasharray="3 2"
                      />
                      <text
                        x="120"
                        y="87"
                        textAnchor="middle"
                        fontSize="7.5"
                        fontWeight="700"
                        fill={isDark ? '#7DD3FC' : '#0369A1'}
                      >
                        {design.policies.hsrpEnabled ? 'HSRP VIP' : 'SIN HSRP'}
                      </text>

                      <line x1="72" y1="112" x2="120" y2="148" stroke="#64748B" strokeWidth="1.5" />
                      <line x1="168" y1="112" x2="120" y2="148" stroke="#64748B" strokeWidth="1.5" />

                      <rect
                        x="68"
                        y="148"
                        width="104"
                        height="24"
                        rx="4"
                        fill={isDark ? '#1E293B' : '#FFFFFF'}
                        stroke="#475569"
                        strokeWidth="1.4"
                      />
                      <text
                        x="120"
                        y="163"
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="700"
                        fill={isDark ? '#F1F5F9' : '#0F172A'}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        SW-CORE 10G
                      </text>

                      <line
                        x1="120"
                        y1="172"
                        x2="120"
                        y2="210"
                        stroke={faults.coreFiberCut ? '#EF4444' : '#7C3AED'}
                        strokeWidth="2"
                        strokeDasharray={faults.coreFiberCut ? '4 3' : undefined}
                      />
                      {faults.coreFiberCut && (
                        <text x="162" y="195" fontSize="8" fontWeight="700" fill="#EF4444">
                          {design.policies.frrEnabled ? 'FRR <50ms' : 'CORTE FIBRA'}
                        </text>
                      )}

                      <rect
                        x="36"
                        y="210"
                        width="168"
                        height="36"
                        rx="6"
                        fill={isDark ? '#2E1065' : '#F3E8FF'}
                        stroke="#7C3AED"
                        strokeWidth="1.4"
                      />
                      <text
                        x="120"
                        y="226"
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="700"
                        fill={isDark ? '#DDD6FE' : '#5B21B6'}
                      >
                        ANILLO MPLS / METRO / OLT
                      </text>
                      <text
                        x="120"
                        y="239"
                        textAnchor="middle"
                        fontSize="7.5"
                        fill={isDark ? '#C4B5FD' : '#6D28D9'}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {evaluation.totalDemandMbps.toFixed(0)} / {evaluation.totalCapacityMbps} Mbps
                      </text>

                      <line x1="80" y1="246" x2="65" y2="274" stroke="#0284C7" strokeWidth="1.4" />
                      <line x1="160" y1="246" x2="175" y2="274" stroke="#059669" strokeWidth="1.4" />
                      <rect
                        x="18"
                        y="274"
                        width="94"
                        height="24"
                        rx="4"
                        fill={isDark ? '#1E293B' : '#FFFFFF'}
                        stroke={isDark ? '#475569' : '#CBD5E1'}
                      />
                      <text
                        x="65"
                        y="289"
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="600"
                        fill={isDark ? '#E2E8F0' : '#1E293B'}
                      >
                        DHCP / IPv6 PD
                      </text>
                      <rect
                        x="128"
                        y="274"
                        width="94"
                        height="24"
                        rx="4"
                        fill={isDark ? '#1E293B' : '#FFFFFF'}
                        stroke={isDark ? '#475569' : '#CBD5E1'}
                      />
                      <text
                        x="175"
                        y="289"
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="600"
                        fill={isDark ? '#E2E8F0' : '#1E293B'}
                      >
                        CGNAT {design.policies.cgnatRatio}:1
                      </text>
                    </svg>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span>Salida Internet:</span>
                      <strong className="text-slate-900 dark:text-white">
                        {design.policies.internetExit === 'central' ? 'Centralizada DC' : 'Local por sede'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Política QoS:</span>
                      <strong
                        className={
                          design.policies.qosEnabled
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }
                      >
                        {design.policies.qosEnabled ? 'DiffServ Activo' : 'Desactivado (FIFO)'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sites Status Table (including GPON Rx dBm when GPON) */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-md">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-2.5 py-2">Sede / Ciudad</th>
                      <th className="px-2.5 py-2">Tecnología / ODN</th>
                      <th className="px-2.5 py-2 text-right">Demanda / Cap.</th>
                      <th className="px-2.5 py-2 text-right">Uso</th>
                      <th className="px-2.5 py-2 text-right">Latencia</th>
                      <th className="px-2.5 py-2">SLA</th>
                      <th className="px-2.5 py-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {design.sites.map((site) => {
                      const m = evaluation.siteMetrics.find((x) => x.siteId === site.id);
                      const isSel = selectedSiteId === site.id;
                      return (
                        <tr
                          key={site.id}
                          onClick={() => setSelectedSiteId(site.id)}
                          className={`cursor-pointer transition-colors ${
                            isSel
                              ? 'bg-sky-50/90 dark:bg-sky-950/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="px-2.5 py-2 font-medium text-slate-900 dark:text-white">
                            <div>{site.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {site.city} · {site.users} usr
                            </div>
                          </td>
                          <td className="px-2.5 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            <div className="uppercase">{site.technology}</div>
                            {m?.opticalBudget && (
                              <div
                                className={`text-[10px] font-semibold ${
                                  m.opticalBudget.status === 'ok'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {m.opticalBudget.ontRxDbm} dBm ({m.opticalBudget.splitterRatio})
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {m?.demandMbps.toFixed(0)} / {site.capacityMbps} Mbps
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums font-semibold">
                            {m?.utilizationPct.toFixed(1)}%
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                            {m?.status === 'down' ? '---' : `${m?.latencyMs} ms`}
                          </td>
                          <td className="px-2.5 py-2">
                            {m?.slaCompliant ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> OK
                              </span>
                            ) : (
                              <span className="text-rose-700 dark:text-rose-400 font-semibold text-[11px] flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />{' '}
                                {m?.status === 'down' ? 'CAÍDO' : 'ALERTA'}
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            {!site.isPrimaryHub && design.sites.length > 3 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSite(site.id);
                                }}
                                title="Eliminar sede"
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBVIEW 2: DIRECCIONAMIENTO VLSM + DUAL-STACK IPv6 & CGNAT */}
          {subView === 'direccionamiento' && (
            <div className="p-4 space-y-3">
              {/* IPv6 Dual-Stack & RFC 6598 CGNAT Summary Strip */}
              <div className="p-3 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">Bloque ISP IPv6</div>
                  <div className="font-mono font-bold text-sky-900 dark:text-sky-300">
                    {design.policies.ipv6IspPrefix}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Corp: /48 · GPON PD: /56
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">Pool CGNAT (RFC 6598)</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                    {cgnatSummary.cgnatPoolCidr}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Adopción IPv6: {cgnatSummary.ipv6OffloadPct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">Sesiones IPv4 CGNAT</div>
                  <div className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                    {cgnatSummary.remainingIpv4Sessions.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    De {cgnatSummary.baseIpv4Sessions.toLocaleString()} sin IPv6
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">IPs Públicas Requeridas</div>
                  <div className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {cgnatSummary.publicIpsWithIpv6}{' '}
                    <span className="text-[11px] font-mono">(-{cgnatSummary.publicIpsSaved} ahorradas)</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-md max-h-[500px] overflow-y-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 sticky top-0">
                    <tr>
                      <th className="px-2 py-2">Sede / VLAN</th>
                      <th className="px-2 py-2">Red IPv4 / CIDR</th>
                      <th className="px-2 py-2">Gateway / Rango DHCP</th>
                      <th className="px-2 py-2">Prefijo IPv6 Dual-Stack</th>
                      <th className="px-2 py-2 text-right">Uso IPv4</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                    {vlsmRows.map((r) => (
                      <tr key={`${r.siteId}-${r.vlanId}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-2 py-1.5">
                          <div className="font-semibold text-slate-900 dark:text-white">{r.siteName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            VLAN {r.vlanId} · {r.vlanName}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 font-mono font-semibold text-sky-900 dark:text-sky-300 tabular-nums">
                          <div>
                            {r.network}/{r.cidr}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{r.mask}</div>
                        </td>
                        <td className="px-2 py-1.5 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                          <div>GW: {r.gateway}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{r.dhcpRange}</div>
                        </td>
                        <td className="px-2 py-1.5 font-mono text-violet-800 dark:text-violet-300">
                          <div>{r.ipv6Prefix}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{r.ipv6Type}</div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                          <span
                            className={`font-semibold ${
                              r.occupancyPct > 85
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {r.occupancyPct}%
                          </span>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {r.assignedHosts}/{r.usableHosts}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBVIEW 3: RESILIENCIA N-1 Y DIFFSERV-TE EN MPLS */}
          {subView === 'resiliencia' && (
            <div className="p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Matriz de Contingencia N-1 y DiffServ-TE en Hora Pico
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Evalúa el impacto en rutas de respaldo al cortar enlaces troncales o un PE completo, verificando preservación de tráfico crítico EF y AF31/AF41.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    design.policies.qosEnabled && design.policies.frrEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                  }`}
                >
                  DiffServ-TE: {design.policies.qosEnabled && design.policies.frrEnabled ? 'ACTIVO' : 'INCOMPLETO'}
                </span>
              </div>

              <div className="space-y-2.5">
                {evaluation.n1Matrix.map((sc) => (
                  <div
                    key={sc.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{sc.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Falla: {sc.failedElement} → Respaldo: {sc.backupPath}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                          sc.verdict === 'resilient'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : sc.verdict === 'degraded_be'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {sc.verdict === 'resilient'
                          ? 'RESILIENTE'
                          : sc.verdict === 'degraded_be'
                          ? 'SOLO BE AFECTADO'
                          : 'SATURACIÓN CRÍTICA'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Uso ruta respaldo</div>
                        <div
                          className={`font-display text-base font-bold tabular-nums ${
                            sc.backupUtilizationPct > 95
                              ? 'text-rose-700 dark:text-rose-400'
                              : sc.backupUtilizationPct > 80
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {sc.backupUtilizationPct}%
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {sc.reroutedDemandMbps}/{sc.backupCapacityMbps}M
                        </div>
                      </div>

                      <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Voz EF (LLQ)</div>
                        <div
                          className={`font-semibold mt-0.5 ${
                            sc.criticalEfPreserved
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {sc.criticalEfPreserved ? 'SLA Intacto' : 'Degradado'}
                        </div>
                      </div>

                      <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Corp AF31/AF41</div>
                        <div
                          className={`font-semibold mt-0.5 ${
                            sc.corpAfPreserved
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {sc.corpAfPreserved ? 'SLA Intacto' : 'Afectado'}
                        </div>
                      </div>

                      <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Descarte Best Effort</div>
                        <div className="font-display text-base font-bold tabular-nums text-slate-900 dark:text-white">
                          {sc.bestEffortDropPct}%
                        </div>
                      </div>

                      <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Conmutación</div>
                        <div className="font-display text-base font-bold tabular-nums text-sky-800 dark:text-sky-400">
                          {sc.failoverMs} ms
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBVIEW 4: CONFIGURACIONES CLI */}
          {subView === 'configuraciones' && (
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(['all', 'metroethernet', 'mpls', 'gpon'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      aria-pressed={cliTechFilter === tf}
                      onClick={() => setCliTechFilter(tf)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer ${
                        cliTechFilter === tf
                          ? 'bg-slate-900 dark:bg-sky-600 text-white border-slate-900 dark:border-sky-500'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {tf === 'all' ? 'Todas' : WAN_LABELS[tf]}
                    </button>
                  ))}
                </div>

                <select
                  value={activeCliConfig?.id || ''}
                  onChange={(e) => setSelectedCliSiteId(e.target.value)}
                  className="px-2.5 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                >
                  {siteConfigs.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.hostname} ({cfg.roleLabel})
                    </option>
                  ))}
                </select>
              </div>

              {activeCliConfig && (
                <div className="bg-[#0B1120] border border-slate-800 rounded-lg p-3.5 max-h-[500px] overflow-y-auto console-scroll font-mono text-xs leading-relaxed">
                  {activeCliConfig.lines.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.text.startsWith('!')
                          ? 'text-slate-500'
                          : line.text.startsWith('interface') ||
                            line.text.startsWith('policy-map') ||
                            line.text.startsWith('crypto')
                          ? 'text-sky-400 font-semibold'
                          : 'text-slate-200'
                      }
                    >
                      {line.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBVIEW 5: VALIDACIONES DE INGENIERÍA */}
          {subView === 'validaciones' && (
            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Auditoría automática en hora pico ({String(evaluation.peakHour).padStart(2, '0')}:00 h) y ODN GPON
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Detecta saturación de enlaces, incumplimientos SLA, señal óptica ODN fuera de [-27, -8] dBm y problemas MTU/MSS.
                </p>
              </div>

              {evaluation.validations.length === 0 ? (
                <div className="p-6 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-center space-y-1">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <div className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                    Diseño válido sin observaciones críticas
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Todas las sedes cumplen capacidad, SLA de latencia, presupuesto óptico ODN y MTU.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {evaluation.validations.map((issue) => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border text-xs ${
                        issue.severity === 'error'
                          ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                          : issue.severity === 'warning'
                          ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                          : 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {issue.severity === 'error' ? (
                            <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          ) : issue.severity === 'warning' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          ) : (
                            <Wrench className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0" />
                          )}
                          {issue.siteName} · {issue.category}
                        </span>
                        <span className="font-mono text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                          {issue.severity}
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 mb-1">{issue.message}</p>
                      <p className="text-slate-600 dark:text-slate-300">
                        <strong>Recomendación:</strong> {issue.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBVIEW 6: ENTREGABLE ISP / ACTA SLA + ITU-T Y.1564 */}
          {subView === 'acta' && (
            <div className="p-5 space-y-5 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-[11px] font-mono font-bold text-sky-700 dark:text-sky-400 uppercase">
                    Entregable Comercial y Técnico ISP · Certificación Y.1564
                  </div>
                  <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                    Acta de Aceptación de Servicios WAN y Acuerdo SLA — {design.orgName}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                    {design.summaryTag} · {design.sites.length} sedes · Capacidad contratada:{' '}
                    {evaluation.totalCapacityMbps.toLocaleString()} Mbps · Red {design.baseNetworkPrefix}.0.0/16 &{' '}
                    {design.policies.ipv6IspPrefix}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white font-semibold cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Exportar PDF</span>
                </button>
              </div>

              {/* 1. Resumen Ejecutivo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 print-break-inside-avoid">
                <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Disponibilidad Medida</div>
                  <div className="font-display text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {evaluation.globalSlaPct.toFixed(3)}%
                  </div>
                </div>
                <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Sedes Conformes</div>
                  <div className="font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {evaluation.sitesInSla} / {evaluation.totalSites}
                  </div>
                </div>
                <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">OPEX Mensual ISP</div>
                  <div className="font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                    ${evaluation.opex.totalMonthlyUsd.toLocaleString()} USD
                  </div>
                </div>
                <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Penalidad SLA Evitada</div>
                  <div className="font-display text-xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                    ${evaluation.opex.slaPenaltyAvoidedUsd.toLocaleString()} USD/mes
                  </div>
                </div>
              </div>

              {/* 2. Certificación ITU-T Y.1564 */}
              <div className="space-y-2 print-break-inside-avoid">
                <h4 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-sky-700 dark:text-sky-400" />
                  <span>Tabla de Certificación de Activación de Servicio (ITU-T Y.1564)</span>
                </h4>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-md">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-2.5 py-2">Clase CoS / DSCP</th>
                        <th className="px-2.5 py-2 text-right">CIR</th>
                        <th className="px-2.5 py-2 text-right">EIR</th>
                        <th className="px-2.5 py-2 text-right">CBS / EBS</th>
                        <th className="px-2.5 py-2 text-right">FTD (Latencia)</th>
                        <th className="px-2.5 py-2 text-right">FDV (Jitter)</th>
                        <th className="px-2.5 py-2 text-right">FLR (Pérdida)</th>
                        <th className="px-2.5 py-2 text-center">Dictamen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {y1564Classes.map((row) => (
                        <tr key={row.cls}>
                          <td className="px-2.5 py-2 font-semibold text-slate-900 dark:text-white">
                            {row.cls}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                            {row.cirMbps} Mbps
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                            {row.eirMbps} Mbps
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                            {row.cbsKb}/{row.ebsKb} KB
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">{row.ftdMs}</td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">{row.fdvMs}</td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">{row.flrPct}</td>
                          <td className="px-2.5 py-2 text-center font-mono font-bold">
                            <span
                              className={
                                row.pass
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-700 dark:text-rose-400'
                              }
                            >
                              {row.pass ? 'APROBADO' : 'NO CUMPLE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Compromisos SLA y Créditos por Indisponibilidad */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print-break-inside-avoid">
                <div className="border border-slate-200 dark:border-slate-700 rounded-md p-3 space-y-2">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Compromisos SLA y Créditos por Indisponibilidad
                  </h4>
                  <table className="w-full text-[11px] text-left">
                    <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-1">Disponibilidad Mensual</th>
                        <th className="py-1">Indisponibilidad Máx.</th>
                        <th className="py-1 text-right">Crédito MRC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono">
                      <tr>
                        <td className="py-1.5 font-semibold text-emerald-700 dark:text-emerald-400">≥ 99.95%</td>
                        <td className="py-1.5">≤ 21.6 min/mes</td>
                        <td className="py-1.5 text-right">0% ($0)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5">99.50% – 99.94%</td>
                        <td className="py-1.5">22 min – 3.6 h/mes</td>
                        <td className="py-1.5 text-right">
                          10% (${Math.round(evaluation.opex.totalMonthlyUsd * 0.1).toLocaleString()})
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-rose-700 dark:text-rose-400">&lt; 99.50%</td>
                        <td className="py-1.5">&gt; 3.6 h/mes</td>
                        <td className="py-1.5 text-right">
                          25% (${Math.round(evaluation.opex.totalMonthlyUsd * 0.25).toLocaleString()})
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-md p-3 space-y-1.5">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Desglose Financiero OPEX Mensual
                  </h4>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span>MetroEthernet Troncal:</span>
                      <span>${evaluation.opex.metroCostUsd.toLocaleString()} USD</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MPLS L3VPN Corporativo:</span>
                      <span>${evaluation.opex.mplsCostUsd.toLocaleString()} USD</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GPON FTTH (Planta ODN):</span>
                      <span>${evaluation.opex.gponCostUsd.toLocaleString()} USD</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Radioenlace Respaldo + Tránsito IP:</span>
                      <span>
                        ${(evaluation.opex.radioBackupCostUsd + evaluation.opex.ipTransitCostUsd).toLocaleString()}{' '}
                        USD
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>IPv4 Públicas / CGNAT (con {cgnatSummary.ipv6OffloadPct}% IPv6):</span>
                      <span>${evaluation.opex.publicIpAndCgnatCostUsd.toLocaleString()} USD</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                      <span>Total OPEX Mensual:</span>
                      <span>${evaluation.opex.totalMonthlyUsd.toLocaleString()} USD</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===================================================================
          RIGHT PANEL: 24h Slider, Baseline Comparator, OPEX, KPIs, Faults, Site Detail
         =================================================================== */}
      <aside className="xl:col-span-3 flex flex-col gap-3.5 no-print">
        {/* Hour Slider + Play Day */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Ciclo de carga 24 horas
            </h2>
            <span className="font-display text-xl font-bold text-sky-800 dark:text-sky-400 tabular-nums">
              {String(activeHour).padStart(2, '0')}:00
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={23}
            step={1}
            value={activeHour}
            onChange={(e) => onChangeHour(Number(e.target.value))}
            className="w-full accent-sky-700"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span>00:00</span>
            <span>Pico: {String(evaluation.peakHour).padStart(2, '0')}:00</span>
            <span>23:00</span>
          </div>

          <button
            type="button"
            onClick={() => setIsPlayingDay((p) => !p)}
            className="w-full py-1.5 px-3 bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isPlayingDay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlayingDay ? 'Pausar ciclo 24h' : 'Reproducir el día'}</span>
          </button>
        </section>

        {/* Comparador de Escenarios ("Línea base vs. Diseño actual") */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <GitCompare className="w-4 h-4 text-sky-700 dark:text-sky-400" />
              <span>Línea base vs. Actual</span>
            </h3>
            <button
              type="button"
              onClick={onSaveBaseline}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white text-[11px] font-semibold cursor-pointer"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Fijar línea base</span>
            </button>
          </div>

          {!baseline ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Guarda una captura actual para medir el delta exacto (ms, %, Mbps, OPEX) tras activar QoS, migrar accesos o inyectar fallas.
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span>Ref: {baseline.label}</span>
                <button
                  type="button"
                  onClick={onClearBaseline}
                  className="text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
              {(() => {
                const dSla = evaluation.globalSlaPct - baseline.globalSlaPct;
                const dLat = evaluation.avgLatencyMs - baseline.avgLatencyMs;
                const dMbps = evaluation.totalDemandMbps - baseline.totalDemandMbps;
                const dOpex = evaluation.opex.totalMonthlyUsd - baseline.opexMonthlyUsd;
                return (
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Delta SLA</div>
                      <div className={`font-bold tabular-nums ${dSla >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                        {dSla >= 0 ? '+' : ''}{dSla.toFixed(3)} %
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Delta Latencia</div>
                      <div className={`font-bold tabular-nums ${dLat <= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                        {dLat >= 0 ? '+' : ''}{dLat.toFixed(1)} ms
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Delta Demanda</div>
                      <div className="font-bold tabular-nums text-slate-900 dark:text-white">
                        {dMbps >= 0 ? '+' : ''}{dMbps.toFixed(1)} Mbps
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Delta OPEX</div>
                      <div className={`font-bold tabular-nums ${dOpex <= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {dOpex >= 0 ? '+' : ''}${dOpex.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </section>

        {/* 6 Global KPI Indicators + OPEX Estimator */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs space-y-2.5">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Indicadores globales y OPEX
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Demanda agregada</div>
              <div className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {evaluation.totalDemandMbps.toFixed(0)} Mbps
              </div>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Capacidad total</div>
              <div className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {evaluation.totalCapacityMbps} Mbps
              </div>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Sedes en SLA</div>
              <div
                className={`font-display text-lg font-bold tabular-nums ${
                  evaluation.sitesInSla === evaluation.totalSites
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {evaluation.sitesInSla} / {evaluation.totalSites}
              </div>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Latencia media</div>
              <div className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {evaluation.avgLatencyMs} ms
              </div>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Usuarios / Dispos.</div>
              <div className="font-display text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {totalUsers.toLocaleString()} / {totalDevices.toLocaleString()}
              </div>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>OPEX Mensual</span>
              </div>
              <div className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                ${evaluation.opex.totalMonthlyUsd.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
            <span>Ahorro penalidades SLA:</span>
            <strong className="font-mono text-sky-700 dark:text-sky-400">
              ${evaluation.opex.slaPenaltyAvoidedUsd.toLocaleString()} USD/mes
            </strong>
          </div>
        </section>

        {/* Inyector de Fallas */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>Inyector de fallas</span>
            </h3>
            <button
              type="button"
              onClick={() =>
                onChangeFaults(() => ({
                  cutSiteId: null,
                  centralInternetDown: false,
                  primaryRouterDown: false,
                  coreFiberCut: false,
                }))
              }
              className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
            >
              Restaurar todo
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onChangeFaults((f) => ({
                ...f,
                cutSiteId: f.cutSiteId === selectedSite?.id ? null : selectedSite?.id || null,
              }))
            }
            className={`w-full px-2.5 py-1.5 rounded border text-left font-medium cursor-pointer ${
              faults.cutSiteId
                ? 'bg-rose-700 border-rose-700 text-white'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {faults.cutSiteId
              ? `Enlace cortado: ${design.sites.find((s) => s.id === faults.cutSiteId)?.city}`
              : `Cortar enlace de ${selectedSite?.city || 'sede'}`}
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeFaults((f) => ({ ...f, centralInternetDown: !f.centralInternetDown }))
            }
            className={`w-full px-2.5 py-1.5 rounded border text-left font-medium cursor-pointer ${
              faults.centralInternetDown
                ? 'bg-rose-700 border-rose-700 text-white'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {faults.centralInternetDown ? 'Internet central CAÍDO' : 'Caer Internet central (DC)'}
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeFaults((f) => ({ ...f, primaryRouterDown: !f.primaryRouterDown }))
            }
            className={`w-full px-2.5 py-1.5 rounded border text-left font-medium cursor-pointer ${
              faults.primaryRouterDown
                ? 'bg-amber-700 border-amber-700 text-white'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {faults.primaryRouterDown
              ? `Router DC apagado (${design.policies.hsrpEnabled ? 'HSRP OK' : 'SIN HSRP'})`
              : 'Apagar router principal DC'}
          </button>

          <button
            type="button"
            onClick={() => onChangeFaults((f) => ({ ...f, coreFiberCut: !f.coreFiberCut }))}
            className={`w-full px-2.5 py-1.5 rounded border text-left font-medium cursor-pointer ${
              faults.coreFiberCut
                ? 'bg-amber-700 border-amber-700 text-white'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {faults.coreFiberCut
              ? `Fibra núcleo cortada (${design.policies.frrEnabled ? 'FRR <50ms' : 'Degradado'})`
              : 'Cortar fibra del núcleo MPLS'}
          </button>
        </section>

        {/* Detalle de Sede Seleccionada + Presupuesto Óptico GPON ODN + Gráfico 24h */}
        {selectedSite && selectedMetric && (
          <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs space-y-2.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-400 font-semibold">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{selectedSite.city}</span>
                </div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {selectedSite.name}
                </h3>
              </div>
              <Router className="w-4 h-4 text-slate-400 shrink-0" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Tecnología
                </label>
                <select
                  value={selectedSite.technology}
                  onChange={(e) => {
                    const tech = e.target.value as WanArchitecture;
                    handleUpdateSiteField(selectedSite.id, 'technology', tech);
                    if (tech === 'gpon' && !selectedSite.splitterRatio) {
                      handleUpdateSiteField(selectedSite.id, 'splitterRatio', '1:32');
                      handleUpdateSiteField(selectedSite.id, 'gponOpticalClass', 'B+');
                      if (selectedSite.distanceKm > 35) {
                        handleUpdateSiteField(selectedSite.id, 'distanceKm', 14);
                      }
                    }
                  }}
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-medium text-slate-900 dark:text-slate-100"
                >
                  <option value="metroethernet">MetroEthernet</option>
                  <option value="mpls">MPLS L3VPN</option>
                  <option value="gpon">GPON FTTH</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Capacidad (Mbps)
                </label>
                <input
                  type="number"
                  min={20}
                  max={10000}
                  step={20}
                  value={selectedSite.capacityMbps}
                  onChange={(e) =>
                    handleUpdateSiteField(
                      selectedSite.id,
                      'capacityMbps',
                      Math.max(20, Number(e.target.value))
                    )
                  }
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Usuarios
                </label>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  step={10}
                  value={selectedSite.users}
                  onChange={(e) => {
                    const u = Math.max(10, Number(e.target.value));
                    handleUpdateSiteField(selectedSite.id, 'users', u);
                    handleUpdateSiteField(selectedSite.id, 'devices', Math.round(u * 1.35));
                  }}
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  {selectedSite.technology === 'gpon' ? 'Fibra ODN (km)' : 'Distancia (km)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={1200}
                  step={1}
                  value={selectedSite.distanceKm}
                  onChange={(e) =>
                    handleUpdateSiteField(
                      selectedSite.id,
                      'distanceKm',
                      Math.max(1, Number(e.target.value))
                    )
                  }
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>

              {selectedSite.technology === 'gpon' && (
                <>
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      Splitter PON
                    </label>
                    <select
                      value={selectedSite.splitterRatio || '1:32'}
                      onChange={(e) =>
                        handleUpdateSiteField(
                          selectedSite.id,
                          'splitterRatio',
                          e.target.value as GponSplitterRatio
                        )
                      }
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-slate-900 dark:text-slate-100"
                    >
                      <option value="1:8">1:8 (-10.5 dB)</option>
                      <option value="1:16">1:16 (-13.8 dB)</option>
                      <option value="1:32">1:32 (-17.2 dB)</option>
                      <option value="1:64">1:64 (-20.5 dB)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      Clase Óptica OLT
                    </label>
                    <select
                      value={selectedSite.gponOpticalClass || 'B+'}
                      onChange={(e) =>
                        handleUpdateSiteField(
                          selectedSite.id,
                          'gponOpticalClass',
                          e.target.value as GponOpticalClass
                        )
                      }
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-slate-900 dark:text-slate-100"
                    >
                      <option value="B+">Clase B+ (+3 dBm)</option>
                      <option value="C+">Clase C+ (+5 dBm)</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* GPON Optical Budget Card */}
            {selectedMetric.opticalBudget && (
              <div
                className={`p-2.5 rounded-md border text-[11px] space-y-1 ${
                  selectedMetric.opticalBudget.status === 'ok'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50/80 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1 text-slate-900 dark:text-white">
                    <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Presupuesto Óptico ODN
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      selectedMetric.opticalBudget.status === 'ok'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {selectedMetric.opticalBudget.ontRxDbm} dBm
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300 font-mono">
                  <span>Atenuación total: {selectedMetric.opticalBudget.totalAttenuationDb} dB</span>
                  <span>Margen: {selectedMetric.opticalBudget.marginDb} dB</span>
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-300">
                  {selectedMetric.opticalBudget.status === 'ok' ? (
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                      <ShieldCheck className="w-3 h-3" /> Dentro de ventana [-27.0, -8.0] dBm
                    </span>
                  ) : selectedMetric.opticalBudget.status === 'low_signal' ? (
                    <span className="text-rose-700 dark:text-rose-400 font-semibold">
                      ALERTA: Bajo sensibilidad (-27 dBm). Usar Clase C+ o reducir splitter.
                    </span>
                  ) : (
                    <span className="text-rose-700 dark:text-rose-400 font-semibold">
                      ALERTA: Saturación (&gt; -8 dBm). Insertar atenuador o splitter 1:16.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 24-Hour Demand vs Capacity Chart */}
            <div className="pt-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 mb-1">
                <span>Demanda 24h vs Capacidad</span>
                <span className="font-mono font-semibold tabular-nums">
                  {selectedMetric.demandMbps.toFixed(1)} / {selectedSite.capacityMbps} Mbps
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2">
                {(() => {
                  const series = selectedMetric.hourlySeries;
                  const maxVal = Math.max(selectedSite.capacityMbps * 1.15, ...series, 100);
                  const w = 240;
                  const h = 95;
                  const capY = h - (selectedSite.capacityMbps / maxVal) * (h - 14) - 6;
                  const points = series
                    .map((v, idx) => {
                      const x = (idx / 23) * (w - 12) + 6;
                      const y = h - (v / maxVal) * (h - 14) - 6;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');
                  const curX = (activeHour / 23) * (w - 12) + 6;
                  const curY = h - (series[activeHour] / maxVal) * (h - 14) - 6;

                  return (
                    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24 block">
                      <line
                        x1="4"
                        y1={capY}
                        x2={w - 4}
                        y2={capY}
                        stroke="#EF4444"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                      />
                      <text
                        x="6"
                        y={Math.max(10, capY - 3)}
                        fontSize="8"
                        fill="#EF4444"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        Cap: {selectedSite.capacityMbps} Mbps
                      </text>

                      <polyline
                        points={points}
                        fill="none"
                        stroke="#0284C7"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />

                      <line
                        x1={curX}
                        y1="4"
                        x2={curX}
                        y2={h - 4}
                        stroke="#94A3B8"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={curX}
                        cy={curY}
                        r="3.8"
                        fill={isDark ? '#38BDF8' : '#0F172A'}
                        stroke="#FFFFFF"
                        strokeWidth="1.2"
                      />
                    </svg>
                  );
                })()}
              </div>
            </div>
          </section>
        )}
      </aside>
    </div>
  );
};
