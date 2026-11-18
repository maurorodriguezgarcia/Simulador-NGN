import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Clock,
  Cpu,
  Layers,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
  DesignValidationIssue,
  InfraDesign,
  ScenarioId,
  SiteHourlyMetrics,
  SiteNode,
} from '../types/network';

interface ConvergenceTabProps {
  design: InfraDesign;
  evaluation: {
    siteMetrics: SiteHourlyMetrics[];
    globalSlaPct: number;
    sitesInSla: number;
    totalSites: number;
    totalDemandMbps: number;
    totalCapacityMbps: number;
    avgLatencyMs: number;
    validations: DesignValidationIssue[];
  };
  sedeA: SiteNode;
  sedeB: SiteNode;
  sedeC: SiteNode;
  onJumpToScenario: (scenarioId: ScenarioId) => void;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const w = 110;
  const h = 28;
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-24 h-7 block">
      <polyline fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

export const ConvergenceTab: React.FC<ConvergenceTabProps> = ({
  design,
  evaluation,
  sedeA,
  sedeB,
  sedeC,
  onJumpToScenario,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const jitterJitter = ((tick % 5) - 2) * 0.1;
  const cpuJitter = (idx: number) => ((tick + idx * 3) % 7) - 3;

  const kpiCards = useMemo(() => {
    const loadPct = Number(
      ((evaluation.totalDemandMbps / Math.max(1, evaluation.totalCapacityMbps)) * 100).toFixed(1)
    );
    return [
      {
        label: 'Disponibilidad SLA Red',
        value: `${evaluation.globalSlaPct.toFixed(3)}%`,
        sub: `${evaluation.sitesInSla}/${evaluation.totalSites} sedes nominales`,
        color: '#10B981',
        series: [99.91, 99.94, 99.93, 99.95, 99.97, evaluation.globalSlaPct],
      },
      {
        label: 'Tráfico Agregado WAN',
        value: `${evaluation.totalDemandMbps.toFixed(0)} Mbps`,
        sub: `Utilización global ${loadPct}%`,
        color: '#38BDF8',
        series: [
          evaluation.totalDemandMbps * 0.72,
          evaluation.totalDemandMbps * 0.81,
          evaluation.totalDemandMbps * 0.88,
          evaluation.totalDemandMbps * 0.94,
          evaluation.totalDemandMbps * 0.98,
          evaluation.totalDemandMbps,
        ],
      },
      {
        label: 'Latencia Media E2E',
        value: `${(evaluation.avgLatencyMs + jitterJitter).toFixed(1)} ms`,
        sub: `Umbral voz ≤ ${design.policies.slaLatencyVoiceMs} ms`,
        color: '#38BDF8',
        series: [14.2, 13.8, 14.5, 14.1, 13.9, evaluation.avgLatencyMs],
      },
      {
        label: 'Jitter Plano Voz EF',
        value: `${(design.policies.qosEnabled ? 1.6 : 6.4).toFixed(1)} ms`,
        sub: design.policies.qosEnabled ? 'Cola LLQ prioritaria' : 'Sin LLQ (FIFO)',
        color: design.policies.qosEnabled ? '#10B981' : '#F59E0B',
        series: [1.8, 1.5, 1.7, 1.4, 1.6, design.policies.qosEnabled ? 1.6 : 6.4],
      },
      {
        label: 'Sesiones NAT / CGNAT',
        value: `${(design.sites.reduce((a, s) => a + s.users, 0) * 3.4).toFixed(0)}`,
        sub: `Relación ${design.policies.cgnatRatio}:1`,
        color: '#A78BFA',
        series: [4200, 5100, 6400, 7200, 7900, design.sites.reduce((a, s) => a + s.users, 0) * 3.4],
      },
      {
        label: 'Túneles IPsec / MPLS UP',
        value: `${design.sites.length - 1} / ${design.sites.length - 1}`,
        sub: design.policies.frrEnabled ? 'TE-FRR <50 ms armado' : 'FRR desactivado',
        color: '#10B981',
        series: [8, 9, 10, 11, 12, design.sites.length - 1],
      },
      {
        label: 'Leases DHCP Activos',
        value: `${design.sites.reduce((a, s) => a + s.devices, 0).toLocaleString()}`,
        sub: 'Snooping untrusted activo',
        color: '#38BDF8',
        series: [3100, 3400, 3900, 4200, 4450, design.sites.reduce((a, s) => a + s.devices, 0)],
      },
      {
        label: 'Alertas Ingeniería',
        value: `${evaluation.validations.length}`,
        sub: evaluation.validations.length === 0 ? 'Sin incidencias activas' : 'Revisar en diseño',
        color: evaluation.validations.length > 0 ? '#F59E0B' : '#10B981',
        series: [3, 2, 2, 1, evaluation.validations.length, evaluation.validations.length],
      },
    ];
  }, [design, evaluation, jitterJitter]);

  const planes: {
    name: string;
    osi: string;
    desc: string;
    accent: string;
    services: { label: string; detail: string; scenario: ScenarioId }[];
  }[] = [
    {
      name: 'Plano de Aplicación y Servicios',
      osi: 'Capas OSI 5–7 (Sesión, Presentación, Aplicación)',
      desc: 'Orquesta servicios convergentes de usuario, telefonía/telemedicina RTP y automatización IP centralizada.',
      accent: 'border-sky-500/40 bg-sky-950/30',
      services: [
        { label: 'DHCP Centralizado & Snooping', detail: `Relay giaddr hacia ${design.baseNetworkPrefix}.10.10`, scenario: 'dhcp' },
        { label: 'Telemedicina / Voz E2E', detail: `Flujo RTP extremo a extremo (${sedeC.city} → DC)`, scenario: 'ngn' },
      ],
    },
    {
      name: 'Plano de Control y Señalización',
      osi: 'Capas OSI 3–4 (Red, Transporte, Control FHRP/Routing)',
      desc: 'Controla redundancia de gateway, traducción de direcciones, marcado QoS y distribución de etiquetas.',
      accent: 'border-violet-500/40 bg-violet-950/30',
      services: [
        { label: 'HSRP v2 Object Tracking', detail: 'Conmutación sub-segundo (250/750 ms)', scenario: 'hsrp' },
        { label: 'NAT Estático & PAT Overload', detail: `Traducción DMZ + CGNAT ${design.policies.cgnatRatio}:1`, scenario: 'nat' },
        { label: 'QoS DiffServ (LLQ + WRED)', detail: 'Priorización DSCP EF / AF41 / AF21', scenario: 'qos' },
      ],
    },
    {
      name: 'Plano de Transporte y Acceso',
      osi: 'Capas OSI 1–2.5 (Física, Enlace, GPON, MPLS, IPsec)',
      desc: 'Encapsula, cifra y conmuta tramas sobre fibra óptica pasiva GPON, túneles VPN y núcleo MPLS L3VPN.',
      accent: 'border-emerald-500/40 bg-emerald-950/30',
      services: [
        { label: 'PPP CHAP MD5 & FTTH PPPoE', detail: `Autenticación ${sedeB.city} / MTU 1492`, scenario: 'ppp' },
        { label: 'VPN GRE sobre IPsec ESP', detail: `Cifrado AES-256 + ajuste MSS 1360`, scenario: 'vpn' },
        { label: 'MPLS L3VPN, LDP & TE-FRR', detail: `Conmutación de etiquetas + FRR <50 ms (${sedeA.city})`, scenario: 'mpls' },
      ],
    },
  ];

  const equipmentRows = useMemo(() => {
    const base = [
      { host: 'R-BORDE-A', role: 'HSRP Active / NAT / IPsec', cpu: 28 + cpuJitter(1), mem: '42%', temp: '41 °C', status: 'UP' },
      { host: 'R-BORDE-B', role: 'HSRP Standby / BGP', cpu: 14 + cpuJitter(2), mem: '36%', temp: '38 °C', status: 'UP' },
      { host: 'PE-01-CORE', role: 'MPLS L3VPN / LDP / TE-FRR', cpu: 34 + cpuJitter(3), mem: '51%', temp: '44 °C', status: 'UP' },
      { host: 'OLT-01-GPON', role: `Acceso FTTH (${sedeC.city})`, cpu: 22 + cpuJitter(4), mem: '39%', temp: '40 °C', status: 'UP' },
      { host: `R-SEDE-${sedeA.city.slice(0, 3).toUpperCase()}`, role: `${sedeA.technology.toUpperCase()} · ${sedeA.capacityMbps}M`, cpu: 31 + cpuJitter(5), mem: '44%', temp: '39 °C', status: 'UP' },
      { host: `R-SEDE-${sedeB.city.slice(0, 3).toUpperCase()}`, role: `PPP/QoS · ${sedeB.capacityMbps}M`, cpu: 26 + cpuJitter(6), mem: '37%', temp: '37 °C', status: 'UP' },
    ];
    return base;
  }, [cpuJitter, sedeA, sedeB, sedeC]);

  const liveSyslogs = useMemo(() => {
    const timeStr = now.toTimeString().slice(0, 8);
    const pool = [
      `${timeStr} [PE-01] %MPLS_LDP-6-NBR_UP: Sesión LDP con P-01 estable. TE-FRR Tunnel50 listo (<50ms).`,
      `${timeStr} [R-BORDE-A] %HSRP-6-ACTIVE: Grupo 1 VIP ${design.baseNetworkPrefix}.10.1 activo (Hello 250ms).`,
      `${timeStr} [OLT-01] %GPON-6-ONT_AUTH: ONT-${sedeC.city} operando T-CONT1 EF · Atenuación -19.2 dBm.`,
      `${timeStr} [R-SEDE-${sedeB.city.slice(0, 3).toUpperCase()}] %QOS-6-LLQ: Cola EF DSCP 46 sin descartes. WRED activo en AF21.`,
      `${timeStr} [SRV-DHCP] %DHCPD-6-POOL: ${design.sites.reduce((a, s) => a + s.devices, 0)} bindings verificados vía ip helper-address.`,
    ];
    const rot = tick % pool.length;
    return [...pool.slice(rot), ...pool.slice(0, rot)];
  }, [now, tick, design, sedeB.city, sedeC.city]);

  return (
    <div className="bg-[#0B1120] text-slate-100 min-h-[calc(100vh-140px)]">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-5 space-y-5">
        {/* NOC Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="font-display text-2xl font-bold text-white tracking-tight">
              Centro de Operaciones de Red (NOC) · Convergencia NGN
            </h2>
            <p className="text-xs text-slate-400">
              {design.orgName} · Telemetría en tiempo real de los 3 planos NGN vinculados al modelo OSI
            </p>
          </div>
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 font-mono text-xs">
            <Clock className="w-4 h-4 text-sky-400" />
            <span className="tabular-nums text-slate-200">{now.toLocaleTimeString('es-CO')}</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-semibold">NOC EN VIVO</span>
          </div>
        </div>

        {/* 8 KPI Cards with Sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map((k) => (
            <div
              key={k.label}
              className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-400 truncate">{k.label}</div>
                <div className="font-display text-2xl font-bold text-white tabular-nums mt-0.5">
                  {k.value}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">{k.sub}</div>
              </div>
              <Sparkline values={k.series} color={k.color} />
            </div>
          ))}
        </div>

        {/* 3 NGN Convergence Planes mapped to OSI */}
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="font-display text-lg font-bold text-white">
              Planos de Convergencia NGN y Salto Directo a Simulación
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
            {planes.map((plane) => (
              <div key={plane.name} className={`rounded-lg border p-4 space-y-3 ${plane.accent}`}>
                <div>
                  <div className="font-mono text-[11px] text-slate-300">{plane.osi}</div>
                  <h4 className="font-display text-lg font-bold text-white mt-0.5">{plane.name}</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{plane.desc}</p>
                </div>

                <div className="space-y-1.5">
                  {plane.services.map((srv) => (
                    <button
                      key={srv.scenario}
                      type="button"
                      onClick={() => onJumpToScenario(srv.scenario)}
                      className="w-full px-3 py-2 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{srv.label}</div>
                        <div className="text-[11px] text-slate-400 truncate">{srv.detail}</div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 group-hover:text-sky-300 shrink-0">
                        Simular
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Grid: Equipment Health Table + Continuous Syslog */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display text-base font-bold text-white">
                  Salud de Equipos Críticos (CPU / Memoria / Estado)
                </h3>
              </div>
              <span className="font-mono text-[11px] text-slate-400">SNMPv3 Polling 1.5s</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 pr-3">Equipo</th>
                    <th className="py-2 pr-3">Rol NGN</th>
                    <th className="py-2 pr-3">Carga CPU</th>
                    <th className="py-2 pr-3">Memoria</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {equipmentRows.map((eq) => (
                    <tr key={eq.host}>
                      <td className="py-2 pr-3 font-mono font-semibold text-sky-300">{eq.host}</td>
                      <td className="py-2 pr-3 text-slate-300">{eq.role}</td>
                      <td className="py-2 pr-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                eq.cpu > 75 ? 'bg-rose-500' : eq.cpu > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.max(5, Math.min(100, eq.cpu))}%` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-slate-200 w-9 text-right">
                            {eq.cpu}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums text-slate-300">{eq.mem}</td>
                      <td className="py-2 font-mono text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> {eq.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-lg p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-sky-400" />
                <h3 className="font-display text-base font-bold text-white">
                  Flujo Continuo de Eventos Syslog
                </h3>
              </div>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="flex-1 bg-[#060A14] border border-slate-800 rounded p-3 font-mono text-[11px] space-y-2 overflow-y-auto max-h-60 console-scroll">
              {liveSyslogs.map((line, i) => (
                <div key={i} className="text-slate-300 leading-relaxed">
                  {line}
                </div>
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                Collector: {design.baseNetworkPrefix}.10.50 (UDP/514)
              </span>
              <span className="font-mono text-emerald-400">0 paquetes perdidos</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
