import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  StepForward,
  Terminal,
} from 'lucide-react';
import {
  InfraDesign,
  ScenarioId,
  ScenarioInteractiveState,
  SiteHourlyMetrics,
  SiteNode,
  SyslogEntry,
  ThemeMode,
  WanArchitecture,
} from '../types/network';
import { buildScenarioSteps, SCENARIO_DEFINITIONS } from '../engine/scenarios';

interface SimulationTabProps {
  theme: ThemeMode;
  wanArch: WanArchitecture;
  design: InfraDesign;
  sedeAId: string;
  sedeBId: string;
  sedeCId: string;
  onChangeSedeA: (id: string) => void;
  onChangeSedeB: (id: string) => void;
  onChangeSedeC: (id: string) => void;
  sedeA: SiteNode;
  sedeB: SiteNode;
  sedeC: SiteNode;
  siteMetrics: SiteHourlyMetrics[];
  activeScenario: ScenarioId;
  onSelectScenario: (id: ScenarioId) => void;
  scenarioState: ScenarioInteractiveState;
  onUpdateScenarioState: (patch: Partial<ScenarioInteractiveState>) => void;
}

const TOPO_NODES: Record<string, { x: number; y: number; label: string }> = {
  SRV_DHCP: { x: 140, y: 52, label: 'SRV-DHCP' },
  SRV_WEB: { x: 615, y: 52, label: 'SRV-WEB DMZ' },
  SW_CORE: { x: 380, y: 60, label: 'SW-CORE DC' },
  R_BORDE_A: { x: 280, y: 140, label: 'R-BORDE-A' },
  R_BORDE_B: { x: 480, y: 140, label: 'R-BORDE-B' },

  PE_01: { x: 250, y: 245, label: 'PE-01' },
  P_01: { x: 390, y: 225, label: 'P-01' },
  P_02: { x: 525, y: 245, label: 'P-02' },

  OLT_01: { x: 575, y: 318, label: 'OLT-01' },
  SPLITTER: { x: 650, y: 355, label: 'Splitter 1:32' },
  ONT_C: { x: 590, y: 388, label: 'ONT-C' },

  R_SEDE_A: { x: 115, y: 358, label: 'R-SEDE-A' },
  SW_SEDE_A: { x: 115, y: 418, label: 'SW-SEDE-A' },
  HOST_A: { x: 115, y: 472, label: 'PC-SEDE-A' },

  R_SEDE_B: { x: 350, y: 358, label: 'R-SEDE-B' },
  SW_SEDE_B: { x: 350, y: 418, label: 'SW-SEDE-B' },
  HOST_B: { x: 350, y: 472, label: 'TEL-SEDE-B' },

  R_SEDE_C: { x: 545, y: 444, label: 'R-SEDE-C' },
  SW_SEDE_C: { x: 655, y: 444, label: 'SW-SEDE-C' },
  HOST_C: { x: 655, y: 484, label: 'MED-SEDE-C' },
};

function interpolatePolyline(points: { x: number; y: number }[], t: number): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const d = Math.hypot(dx, dy);
    segLengths.push(d);
    totalLen += d;
  }
  if (totalLen === 0) return points[0];
  const target = Math.max(0, Math.min(1, t)) * totalLen;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const seg = segLengths[i];
    if (acc + seg >= target || i === segLengths.length - 1) {
      const localT = seg > 0 ? (target - acc) / seg : 0;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * localT,
        y: points[i].y + (points[i + 1].y - points[i].y) * localT,
      };
    }
    acc += seg;
  }
  return points[points.length - 1];
}

export const SimulationTab: React.FC<SimulationTabProps> = ({
  theme,
  wanArch,
  design,
  sedeAId,
  sedeBId,
  sedeCId,
  onChangeSedeA,
  onChangeSedeB,
  onChangeSedeC,
  sedeA,
  sedeB,
  sedeC,
  siteMetrics,
  activeScenario,
  onSelectScenario,
  scenarioState,
  onUpdateScenarioState,
}) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [packetT, setPacketT] = useState(0);
  const [didacticTab, setDidacticTab] = useState<'object' | 'application' | 'benefit'>('object');
  const [syslogHistory, setSyslogHistory] = useState<SyslogEntry[]>([]);
  const [isSvgFullscreen, setIsSvgFullscreen] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const isDark = theme === 'dark';

  const steps = useMemo(
    () => buildScenarioSteps(activeScenario, wanArch, design, sedeA, sedeB, sedeC, scenarioState),
    [activeScenario, wanArch, design, sedeA, sedeB, sedeC, scenarioState]
  );

  const safeStepIdx = Math.min(stepIdx, Math.max(0, steps.length - 1));
  const currentStep = steps[safeStepIdx];
  const scenarioDef = SCENARIO_DEFINITIONS.find((s) => s.id === activeScenario) || SCENARIO_DEFINITIONS[0];

  useEffect(() => {
    setStepIdx(0);
    setPacketT(0);
    setIsPlaying(true);
  }, [activeScenario]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSvgFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!currentStep) return;
    setSyslogHistory((prev) => {
      const entry = currentStep.syslog;
      const last = prev[prev.length - 1];
      if (last && last.mnemonic === entry.mnemonic && last.message === entry.message) {
        return prev;
      }
      return [...prev.slice(-14), entry];
    });
  }, [currentStep]);

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      return;
    }
    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setPacketT((prev) => {
        const next = prev + dt * 0.42 * speed;
        if (next >= 1) {
          setStepIdx((s) => (s + 1) % steps.length);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [isPlaying, speed, steps.length]);

  const pathCoords = useMemo(() => {
    return (currentStep?.pathPoints || [])
      .map((id) => TOPO_NODES[id])
      .filter(Boolean);
  }, [currentStep]);

  const packetPos = useMemo(() => interpolatePolyline(pathCoords, packetT), [pathCoords, packetT]);

  const totalLayerBytes = Math.max(
    1,
    currentStep.layers.reduce((acc, l) => acc + l.bytes, 0)
  );

  const groupedScenarios = useMemo(() => {
    const categories = [
      'Servicios de borde',
      'Acceso WAN y NAT',
      'VPN, MPLS y QoS',
      'Convergencia NGN',
    ] as const;
    return categories.map((cat) => ({
      cat,
      items: SCENARIO_DEFINITIONS.filter((s) => s.category === cat),
    }));
  }, []);

  const prefix = design.baseNetworkPrefix;
  const hsrpBackupActive = activeScenario === 'hsrp' && scenarioState.hsrpFailureMode !== 'normal';
  const mplsCutActive = activeScenario === 'mpls' && scenarioState.mplsFiberCut;
  const rogueActive = activeScenario === 'dhcp' && scenarioState.dhcpRogueServer;

  const metricA = siteMetrics.find((m) => m.siteId === sedeA.id);
  const metricB = siteMetrics.find((m) => m.siteId === sedeB.id);
  const metricC = siteMetrics.find((m) => m.siteId === sedeC.id);

  const renderSlaChipOnSvg = (
    x: number,
    y: number,
    site: SiteNode,
    metric: SiteHourlyMetrics | undefined
  ) => {
    const ok = metric ? metric.slaCompliant : true;
    const isDown = metric?.status === 'down';
    const badgeFill = isDown
      ? isDark
        ? '#450A0A'
        : '#FEF2F2'
      : ok
      ? isDark
        ? '#064E3B'
        : '#ECFDF5'
      : isDark
      ? '#451A03'
      : '#FFFBEB';
    const badgeStroke = isDown ? '#EF4444' : ok ? '#10B981' : '#F59E0B';
    const badgeText = isDown
      ? isDark
        ? '#FCA5A5'
        : '#B91C1C'
      : ok
      ? isDark
        ? '#6EE7B7'
        : '#047857'
      : isDark
      ? '#FCD34D'
      : '#B45309';

    const labelStr = `${site.technology.toUpperCase()} · ${site.capacityMbps}M`;
    const slaStr = isDown
      ? 'CAÍDO'
      : ok
      ? `SLA OK ${metric ? `${metric.latencyMs}ms` : ''}`
      : `SLA ALERTA ${metric ? `${metric.latencyMs}ms` : ''}`;

    return (
      <g transform={`translate(${x}, ${y})`}>
        <rect
          x="0"
          y="0"
          width="160"
          height="16"
          rx="3"
          fill={badgeFill}
          stroke={badgeStroke}
          strokeWidth="0.9"
        />
        <text
          x="5"
          y="10.8"
          fontSize="7.6"
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
          fill={isDark ? '#E2E8F0' : '#0F172A'}
        >
          {labelStr}
        </text>
        <text
          x="155"
          y="10.8"
          textAnchor="end"
          fontSize="7.6"
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
          fill={badgeText}
        >
          {slaStr}
        </text>
      </g>
    );
  };

  const renderTopologySvg = () => (
    <svg viewBox="0 0 760 520" className="w-full h-auto block select-none">
      <defs>
        <filter id="packetGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 1. Datacenter Principal */}
      <rect
        x="45"
        y="12"
        width="670"
        height="158"
        rx="10"
        fill={isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.84)'}
        stroke={isDark ? '#334155' : '#CBD5E1'}
        strokeWidth="1.2"
      />
      <text
        x="58"
        y="29"
        fontSize="10.5"
        fontWeight="700"
        fill={isDark ? '#CBD5E1' : '#475569'}
        fontFamily="Saira, sans-serif"
      >
        DATACENTER PRINCIPAL · {design.orgName.toUpperCase()}
      </text>

      {/* HSRP Virtual Ring */}
      <ellipse
        cx="380"
        cy="140"
        rx="132"
        ry="26"
        fill={
          hsrpBackupActive
            ? isDark
              ? 'rgba(217, 119, 6, 0.16)'
              : 'rgba(217, 119, 6, 0.08)'
            : isDark
            ? 'rgba(56, 189, 248, 0.12)'
            : 'rgba(2, 132, 199, 0.07)'
        }
        stroke={hsrpBackupActive ? '#F59E0B' : isDark ? '#38BDF8' : '#0284C7'}
        strokeWidth="1.4"
        strokeDasharray="4 3"
      />
      <text
        x="380"
        y="159"
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill={isDark ? '#7DD3FC' : '#0369A1'}
        fontFamily="JetBrains Mono, monospace"
      >
        HSRP VIP {prefix}.10.1 ({hsrpBackupActive ? 'R-BORDE-B Active' : 'R-BORDE-A Active'})
      </text>

      {/* 2. Núcleo del Proveedor */}
      <rect
        x="175"
        y="184"
        width="410"
        height="96"
        rx="10"
        fill={isDark ? 'rgba(30,41,59,0.75)' : 'rgba(241,245,249,0.85)'}
        stroke={isDark ? '#475569' : '#94A3B8'}
        strokeWidth="1.2"
        strokeDasharray="5 3"
      />
      <text
        x="190"
        y="201"
        fontSize="10.5"
        fontWeight="700"
        fill={isDark ? '#E2E8F0' : '#334155'}
        fontFamily="Saira, sans-serif"
      >
        NÚCLEO DEL PROVEEDOR (
        {wanArch === 'mpls'
          ? 'MPLS L3VPN · LDP · TE-FRR'
          : wanArch === 'metroethernet'
          ? 'METROETHERNET Q-IN-Q'
          : 'BACKBONE BNG / MPLS'}
        )
      </text>

      {/* 3. Red Óptica Pasiva GPON */}
      <rect
        x="518"
        y="290"
        width="206"
        height="112"
        rx="8"
        fill={isDark ? 'rgba(6,78,59,0.32)' : 'rgba(236,253,245,0.8)'}
        stroke={isDark ? '#10B981' : '#6EE7B7'}
        strokeWidth="1.2"
      />
      <text
        x="528"
        y="305"
        fontSize="9.5"
        fontWeight="700"
        fill={isDark ? '#6EE7B7' : '#065F46'}
        fontFamily="Saira, sans-serif"
      >
        RED ÓPTICA PASIVA GPON (ODN)
      </text>

      {/* 4. Sedes Remotas Boxes with Synchronized Bandwidth, Tech & SLA Badges */}
      <rect
        x="24"
        y="300"
        width="184"
        height="206"
        rx="8"
        fill={isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.86)'}
        stroke={isDark ? '#334155' : '#CBD5E1'}
        strokeWidth="1.2"
      />
      <text
        x="34"
        y="316"
        fontSize="10"
        fontWeight="700"
        fill={isDark ? '#F1F5F9' : '#1E293B'}
        fontFamily="Saira, sans-serif"
      >
        SEDE A · {sedeA.city.toUpperCase()}
      </text>
      {renderSlaChipOnSvg(34, 321, sedeA, metricA)}

      <rect
        x="258"
        y="300"
        width="184"
        height="206"
        rx="8"
        fill={isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.86)'}
        stroke={isDark ? '#334155' : '#CBD5E1'}
        strokeWidth="1.2"
      />
      <text
        x="268"
        y="316"
        fontSize="10"
        fontWeight="700"
        fill={isDark ? '#F1F5F9' : '#1E293B'}
        fontFamily="Saira, sans-serif"
      >
        SEDE B · {sedeB.city.toUpperCase()}
      </text>
      {renderSlaChipOnSvg(268, 321, sedeB, metricB)}

      <rect
        x="492"
        y="406"
        width="240"
        height="104"
        rx="8"
        fill={isDark ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.88)'}
        stroke={isDark ? '#334155' : '#CBD5E1'}
        strokeWidth="1.2"
      />
      <text
        x="502"
        y="420"
        fontSize="10"
        fontWeight="700"
        fill={isDark ? '#F1F5F9' : '#1E293B'}
        fontFamily="Saira, sans-serif"
      >
        SEDE C · {sedeC.city.toUpperCase()}
      </text>
      {renderSlaChipOnSvg(502, 424, sedeC, metricC)}

      {/* Static Links */}
      {[
        ['SRV_DHCP', 'SW_CORE'],
        ['SRV_WEB', 'SW_CORE'],
        ['SW_CORE', 'R_BORDE_A'],
        ['SW_CORE', 'R_BORDE_B'],
        ['R_BORDE_A', 'PE_01'],
        ['R_BORDE_A', 'P_01'],
        ['R_BORDE_B', 'P_02'],
        ['PE_01', 'P_01'],
        ['PE_01', 'P_02'],
        ['P_01', 'P_02'],
        ['PE_01', 'R_SEDE_A'],
        ['PE_01', 'R_SEDE_B'],
        ['PE_01', 'OLT_01'],
        ['OLT_01', 'SPLITTER'],
        ['SPLITTER', 'ONT_C'],
        ['ONT_C', 'R_SEDE_C'],
        ['R_SEDE_A', 'SW_SEDE_A'],
        ['SW_SEDE_A', 'HOST_A'],
        ['R_SEDE_B', 'SW_SEDE_B'],
        ['SW_SEDE_B', 'HOST_B'],
        ['R_SEDE_C', 'SW_SEDE_C'],
        ['SW_SEDE_C', 'HOST_C'],
      ].map(([a, b]) => {
        const n1 = TOPO_NODES[a];
        const n2 = TOPO_NODES[b];
        const isFiberCut =
          mplsCutActive && ((a === 'PE_01' && b === 'P_01') || (a === 'P_01' && b === 'PE_01'));
        return (
          <g key={`${a}-${b}`}>
            <line
              x1={n1.x}
              y1={n1.y}
              x2={n2.x}
              y2={n2.y}
              stroke={isFiberCut ? '#EF4444' : isDark ? '#475569' : '#94A3B8'}
              strokeWidth={isFiberCut ? 2.4 : 1.8}
              strokeDasharray={isFiberCut ? '4 4' : undefined}
            />
            {isFiberCut && (
              <g transform={`translate(${(n1.x + n2.x) / 2}, ${(n1.y + n2.y) / 2})`}>
                <circle r="9" fill="#DC2626" />
                <text y="3.5" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700">
                  ×
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Rogue DHCP Server node when enabled */}
      {rogueActive && (
        <g transform="translate(215, 455)">
          <line x1="-100" y1="-37" x2="0" y2="0" stroke="#EF4444" strokeWidth="1.6" strokeDasharray="4 3" />
          <rect x="-32" y="-14" width="64" height="28" rx="5" fill="#FEF2F2" stroke="#DC2626" strokeWidth="1.5" />
          <text y="3" textAnchor="middle" fontSize="9" fontWeight="700" fill="#B91C1C" fontFamily="JetBrains Mono, monospace">
            ROGUE DHCP
          </text>
        </g>
      )}

      {/* Active Highlighted Path & Animated Luminous Trail */}
      {pathCoords.length > 1 && (
        <g>
          <polyline
            points={pathCoords.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={currentStep.packetColor}
            strokeWidth="4.5"
            strokeOpacity="0.28"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={pathCoords.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={currentStep.packetColor}
            strokeWidth="2.4"
            className="animate-dash-flow"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* Topology Nodes */}
      {Object.entries(TOPO_NODES).map(([id, node]) => {
        const isActiveEndpoint = currentStep.fromNode === id || currentStep.toNode === id;
        const isRouter = id.startsWith('R_') || id.startsWith('P') || id === 'OLT_01' || id === 'ONT_C';
        const isServer = id.startsWith('SRV_');
        const isSplitter = id === 'SPLITTER';
        const isOff =
          activeScenario === 'hsrp' && scenarioState.hsrpFailureMode === 'router_off' && id === 'R_BORDE_A';

        const nodeBg = isOff
          ? '#FEE2E2'
          : isActiveEndpoint
          ? '#0F172A'
          : isDark
          ? '#1E293B'
          : isRouter || isServer
          ? '#FFFFFF'
          : '#F8FAFC';

        const nodeText = isOff
          ? '#B91C1C'
          : isActiveEndpoint
          ? '#FFFFFF'
          : isDark
          ? '#F1F5F9'
          : '#0F172A';

        return (
          <g key={id} transform={`translate(${node.x}, ${node.y})`}>
            {isSplitter ? (
              <polygon
                points="-16,-11 16,0 -16,11"
                fill={isDark ? '#064E3B' : '#ECFDF5'}
                stroke="#10B981"
                strokeWidth="1.6"
              />
            ) : isRouter ? (
              <circle
                r="15"
                fill={nodeBg}
                stroke={isOff ? '#EF4444' : isActiveEndpoint ? currentStep.packetColor : isDark ? '#64748B' : '#475569'}
                strokeWidth={isActiveEndpoint ? 2.4 : 1.6}
              />
            ) : isServer ? (
              <rect
                x="-26"
                y="-14"
                width="52"
                height="28"
                rx="5"
                fill={nodeBg}
                stroke={isActiveEndpoint ? currentStep.packetColor : isDark ? '#64748B' : '#475569'}
                strokeWidth={isActiveEndpoint ? 2.4 : 1.5}
              />
            ) : (
              <rect
                x="-22"
                y="-11"
                width="44"
                height="22"
                rx="4"
                fill={nodeBg}
                stroke={isActiveEndpoint ? currentStep.packetColor : isDark ? '#64748B' : '#64748B'}
                strokeWidth={isActiveEndpoint ? 2.2 : 1.4}
              />
            )}

            <text
              y="3"
              textAnchor="middle"
              fontSize="8.2"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
              fill={isSplitter && isDark ? '#ECFDF5' : nodeText}
            >
              {id === 'SPLITTER' ? '1:32' : id.replace('_', '-').slice(0, 8)}
            </text>

            <text
              y={isRouter ? 25 : 21}
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="600"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fill={isDark ? '#CBD5E1' : '#334155'}
            >
              {node.label}
            </text>
          </g>
        );
      })}

      {/* Animated Packet Marker + Floating Label */}
      {pathCoords.length > 0 && (
        <g transform={`translate(${packetPos.x}, ${packetPos.y})`} filter="url(#packetGlow)">
          <circle r="9" fill={currentStep.packetColor} fillOpacity="0.28" />
          <circle r="5.5" fill={currentStep.packetColor} stroke="#FFFFFF" strokeWidth="1.8" />
          <g transform="translate(0, -17)">
            <rect
              x="-76"
              y="-11"
              width="152"
              height="18"
              rx="4"
              fill="#0F172A"
              stroke={currentStep.packetColor}
              strokeWidth="1.2"
            />
            <text
              y="1"
              textAnchor="middle"
              fill="#F8FAFC"
              fontSize="9"
              fontWeight="600"
              fontFamily="JetBrains Mono, monospace"
            >
              {currentStep.packetLabel.slice(0, 26)}
            </text>
          </g>
        </g>
      )}
    </svg>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4 grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      {/* Fullscreen Topology Modal */}
      {isSvgFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Topología de simulación en pantalla completa"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs p-4 lg:p-6 flex flex-col"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl flex-1 flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {scenarioDef.fullTitle}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Paso {safeStepIdx + 1}/{steps.length}: {currentStep.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSvgFullscreen(false)}
                  aria-label="Salir de pantalla completa"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-dot-grid flex items-center justify-center p-4 overflow-auto">
              <div className="w-full max-w-5xl">{renderTopologySvg()}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          LEFT COLUMN: Site Selectors, 8 Scenarios + Controls, Didactic Card
         =================================================================== */}
      <aside className="xl:col-span-3 flex flex-col gap-3.5">
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Sedes del diseño en la simulación
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-2.5">
            Sincroniza equipos, redes IP VLSM, pools DHCP, capacidad y estado SLA.
          </p>

          <div className="space-y-2.5 text-xs">
            {[
              { label: 'Sede A · Troncal 802.1Q y MPLS principal', val: sedeAId, fn: onChangeSedeA },
              { label: 'Sede B · Enlace PPP y QoS WAN', val: sedeBId, fn: onChangeSedeB },
              { label: 'Sede C · Acceso FTTH GPON, PPPoE y Túnel', val: sedeCId, fn: onChangeSedeC },
            ].map((sel) => (
              <div key={sel.label}>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {sel.label}
                </label>
                <select
                  value={sel.val}
                  onChange={(e) => sel.fn(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-sky-600/30"
                >
                  {design.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.city} ({s.technology.toUpperCase()} · {s.capacityMbps} Mbps)
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        {/* 8 Escenarios + Parámetros interactivos */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white tracking-tight mb-2.5">
            Escenarios de simulación guiada
          </h2>

          <div className="space-y-3">
            {groupedScenarios.map((grp) => (
              <div key={grp.cat}>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  {grp.cat}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {grp.items.map((item) => {
                    const active = activeScenario === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelectScenario(item.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-md border text-xs font-medium transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          active
                            ? 'bg-slate-900 dark:bg-sky-600 border-slate-900 dark:border-sky-500 text-white'
                            : 'bg-slate-50/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">
                          <span className="font-mono font-bold mr-1.5 opacity-80">{item.number}.</span>
                          {item.shortTitle}
                        </span>
                        <span
                          className={`font-mono text-[10px] shrink-0 ${
                            active ? 'text-sky-300 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.serviceTag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Scenario-Specific Interactive Parameters */}
          <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              Parámetros del escenario activo
            </div>

            {activeScenario === 'dhcp' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Sede solicitante</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['A', 'B', 'C'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={scenarioState.dhcpTargetSite === s}
                        onClick={() => onUpdateScenarioState({ dhcpTargetSite: s })}
                        className={`py-1 rounded border text-xs font-semibold cursor-pointer ${
                          scenarioState.dhcpTargetSite === s
                            ? 'bg-sky-700 border-sky-700 text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Sede {s}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Inyectar servidor DHCP falso (Snooping)
                  </span>
                  <input
                    type="checkbox"
                    checked={scenarioState.dhcpRogueServer}
                    onChange={(e) => onUpdateScenarioState({ dhcpRogueServer: e.target.checked })}
                    className="accent-sky-700 w-4 h-4"
                  />
                </label>
              </div>
            )}

            {activeScenario === 'hsrp' && (
              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-400">Simulación de falla HSRP</label>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    { id: 'normal', label: 'Operación normal (R-BORDE-A Active)' },
                    { id: 'wan_down', label: 'Caída enlace WAN (Track -20)' },
                    { id: 'router_off', label: 'Apagado R-BORDE-A (Hold 750 ms)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={scenarioState.hsrpFailureMode === opt.id}
                      onClick={() =>
                        onUpdateScenarioState({
                          hsrpFailureMode: opt.id as ScenarioInteractiveState['hsrpFailureMode'],
                        })
                      }
                      className={`px-2.5 py-1.5 rounded border text-left font-medium cursor-pointer ${
                        scenarioState.hsrpFailureMode === opt.id
                          ? 'bg-sky-700 border-sky-700 text-white'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeScenario === 'ppp' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    aria-pressed={scenarioState.pppMode === 'serial_chap'}
                    onClick={() => onUpdateScenarioState({ pppMode: 'serial_chap' })}
                    className={`py-1.5 rounded border font-semibold cursor-pointer ${
                      scenarioState.pppMode === 'serial_chap'
                        ? 'bg-sky-700 border-sky-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Serial CHAP MD5
                  </button>
                  <button
                    type="button"
                    aria-pressed={scenarioState.pppMode === 'ftth_pppoe'}
                    onClick={() => onUpdateScenarioState({ pppMode: 'ftth_pppoe' })}
                    className={`py-1.5 rounded border font-semibold cursor-pointer ${
                      scenarioState.pppMode === 'ftth_pppoe'
                        ? 'bg-sky-700 border-sky-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    FTTH PPPoE
                  </button>
                </div>

                {scenarioState.pppMode === 'serial_chap' ? (
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">
                      Contraseña cliente CHAP (espera <code className="font-mono">ngn2026</code>)
                    </label>
                    <input
                      type="text"
                      value={scenarioState.pppSecret}
                      onChange={(e) => onUpdateScenarioState({ pppSecret: e.target.value })}
                      className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                    />
                  </div>
                ) : (
                  <label className="flex items-center justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      Activar ajuste TCP MSS 1452 B
                    </span>
                    <input
                      type="checkbox"
                      checked={scenarioState.pppMssClamp1452}
                      onChange={(e) => onUpdateScenarioState({ pppMssClamp1452: e.target.checked })}
                      className="accent-sky-700 w-4 h-4"
                    />
                  </label>
                )}
              </div>
            )}

            {activeScenario === 'nat' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    aria-pressed={scenarioState.natMode === 'static'}
                    onClick={() => onUpdateScenarioState({ natMode: 'static' })}
                    className={`py-1.5 rounded border font-semibold cursor-pointer ${
                      scenarioState.natMode === 'static'
                        ? 'bg-sky-700 border-sky-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    NAT Estático DMZ
                  </button>
                  <button
                    type="button"
                    aria-pressed={scenarioState.natMode === 'pat_burst'}
                    onClick={() => onUpdateScenarioState({ natMode: 'pat_burst' })}
                    className={`py-1.5 rounded border font-semibold cursor-pointer ${
                      scenarioState.natMode === 'pat_burst'
                        ? 'bg-sky-700 border-sky-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    PAT Overload
                  </button>
                </div>

                {scenarioState.natMode === 'pat_burst' && (
                  <div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                      <span>Ráfaga de sesiones simultáneas</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        {scenarioState.natSessionCount}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={600}
                      step={10}
                      value={scenarioState.natSessionCount}
                      onChange={(e) => onUpdateScenarioState({ natSessionCount: Number(e.target.value) })}
                      className="w-full accent-sky-700"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Tamaño de payload</label>
                  <div className="grid grid-cols-3 gap-1">
                    {([64, 512, 1400] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        aria-pressed={scenarioState.natPayloadBytes === sz}
                        onClick={() => onUpdateScenarioState({ natPayloadBytes: sz })}
                        className={`py-1 rounded border font-mono font-semibold cursor-pointer ${
                          scenarioState.natPayloadBytes === sz
                            ? 'bg-slate-900 dark:bg-sky-600 border-slate-900 dark:border-sky-500 text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {sz} B
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeScenario === 'vpn' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    aria-pressed={scenarioState.vpnMode === 'gre_ipsec'}
                    onClick={() => onUpdateScenarioState({ vpnMode: 'gre_ipsec' })}
                    className={`py-1.5 rounded border font-semibold cursor-pointer ${
                      scenarioState.vpnMode === 'gre_ipsec'
                        ? 'bg-emerald-700 border-emerald-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    GRE + IPsec ESP
                  </button>
                  <button
                    type="button"
                    aria-pressed={scenarioState.vpnMode === 'gre_plain'}
                    onClick={() => onUpdateScenarioState({ vpnMode: 'gre_plain' })}
                    className={`py-1.5 rounded border font-semibold cursor-pointer ${
                      scenarioState.vpnMode === 'gre_plain'
                        ? 'bg-amber-700 border-amber-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    GRE Puro (MitM)
                  </button>
                </div>

                <label className="flex items-center justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Ajuste TCP MSS 1360 bytes</span>
                  <input
                    type="checkbox"
                    checked={scenarioState.vpnMss1360}
                    onChange={(e) => onUpdateScenarioState({ vpnMss1360: e.target.checked })}
                    className="accent-sky-700 w-4 h-4"
                  />
                </label>

                <div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span>Segmento TCP origen</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {scenarioState.vpnTcpSegmentBytes} B
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={1460}
                    step={20}
                    value={scenarioState.vpnTcpSegmentBytes}
                    onChange={(e) =>
                      onUpdateScenarioState({ vpnTcpSegmentBytes: Number(e.target.value) })
                    }
                    className="w-full accent-sky-700"
                  />
                </div>
              </div>
            )}

            {activeScenario === 'mpls' && (
              <label className="flex items-center justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  Simular corte de fibra PE-01 ↔ P-01 (FRR &lt;50 ms)
                </span>
                <input
                  type="checkbox"
                  checked={scenarioState.mplsFiberCut}
                  onChange={(e) => onUpdateScenarioState({ mplsFiberCut: e.target.checked })}
                  className="accent-amber-700 w-4 h-4"
                />
              </label>
            )}

            {activeScenario === 'qos' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    aria-pressed={scenarioState.qosMode === 'diffserv'}
                    onClick={() => onUpdateScenarioState({ qosMode: 'diffserv' })}
                    className={`py-1.5 rounded border font-semibold cursor-pointer ${
                      scenarioState.qosMode === 'diffserv'
                        ? 'bg-emerald-700 border-emerald-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    DiffServ LLQ/WRED
                  </button>
                  <button
                    type="button"
                    aria-pressed={scenarioState.qosMode === 'fifo'}
                    onClick={() => onUpdateScenarioState({ qosMode: 'fifo' })}
                    className={`py-1.5 rounded border font-semibold cursor-pointer ${
                      scenarioState.qosMode === 'fifo'
                        ? 'bg-rose-700 border-rose-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    FIFO sin QoS
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span>Velocidad enlace WAN</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {scenarioState.qosWanSpeedMbps} Mbps
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={scenarioState.qosWanSpeedMbps}
                    onChange={(e) =>
                      onUpdateScenarioState({ qosWanSpeedMbps: Number(e.target.value) })
                    }
                    className="w-full accent-sky-700"
                  />
                </div>
              </div>
            )}

            {activeScenario === 'ngn' && (
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Códec Telemedicina RTP</label>
                <div className="grid grid-cols-2 gap-1">
                  {(['G.711', 'G.729'] as const).map((codec) => (
                    <button
                      key={codec}
                      type="button"
                      aria-pressed={scenarioState.ngnCodec === codec}
                      onClick={() => onUpdateScenarioState({ ngnCodec: codec })}
                      className={`py-1.5 rounded border font-mono font-semibold cursor-pointer ${
                        scenarioState.ngnCodec === codec
                          ? 'bg-sky-700 border-sky-700 text-white'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {codec}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Fundamento teórico */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Fundamento teórico
            </h3>
            <span className="font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-400">
              {scenarioDef.serviceTag}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md mb-2.5">
            {[
              { id: 'object', label: 'Objeto' },
              { id: 'application', label: 'Aplicación' },
              { id: 'benefit', label: 'Beneficio' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={didacticTab === t.id}
                onClick={() => setDidacticTab(t.id as typeof didacticTab)}
                className={`py-1 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                  didacticTab === t.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {scenarioDef.didactic[didacticTab]}
          </p>
        </section>
      </aside>

      {/* ===================================================================
          CENTER COLUMN: Interactive Vector Topology + Playback Controls
         =================================================================== */}
      <section className="xl:col-span-5 flex flex-col gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {scenarioDef.fullTitle}
              </h2>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Arquitectura activa:{' '}
                <strong className="text-slate-700 dark:text-slate-200">{wanArch.toUpperCase()}</strong> · Red base{' '}
                <span className="font-mono">{prefix}.0.0/16</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentStep.transformationBadge && (
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-700 text-sky-800 dark:text-sky-300 rounded">
                  {currentStep.transformationBadge}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsSvgFullscreen(true)}
                aria-label="Expandir topología a pantalla completa"
                title="Expandir topología a pantalla completa"
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expandir</span>
              </button>
            </div>
          </div>

          <div className="bg-dot-grid relative border-b border-slate-200 dark:border-slate-800">
            {renderTopologySvg()}
          </div>

          {/* Step Explanation + Playback Controls */}
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono font-bold text-sky-700 dark:text-sky-400">
                  Paso {safeStepIdx + 1} de {steps.length}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {currentStep.title}
                </h3>
              </div>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                {currentStep.fromNode} → {currentStep.toNode}
              </span>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {currentStep.explanation}
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              {steps.map((st, idx) => (
                <button
                  key={st.index}
                  type="button"
                  aria-pressed={idx === safeStepIdx}
                  onClick={() => {
                    setStepIdx(idx);
                    setPacketT(0);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    idx === safeStepIdx
                      ? 'bg-sky-700 text-white'
                      : idx < safeStepIdx
                      ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-900 dark:text-sky-200 hover:bg-sky-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  P{idx + 1}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setStepIdx((s) => (s + 1) % steps.length);
                    setPacketT(0);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <StepForward className="w-3.5 h-3.5" />
                  <span>Paso siguiente</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStepIdx(0);
                    setPacketT(0);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reiniciar</span>
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 px-1.5 font-medium">
                  Velocidad
                </span>
                {([0.5, 1, 2] as const).map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    aria-pressed={speed === sp}
                    onClick={() => setSpeed(sp)}
                    className={`px-2 py-0.5 text-xs font-mono font-semibold rounded-sm cursor-pointer ${
                      speed === sp
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          RIGHT COLUMN: Packet Inspector, Contextual State, Syslog Console
         =================================================================== */}
      <aside className="xl:col-span-4 flex flex-col gap-3.5">
        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Paquete en tránsito
            </h2>
            <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
              {currentStep.metrics.totalFrameBytes} bytes totales
            </span>
          </div>

          <div className="flex h-7 w-full rounded-md overflow-hidden border border-slate-300 dark:border-slate-700 mb-3">
            {currentStep.layers.map((layer) => {
              const pct = Math.max(7, (layer.bytes / totalLayerBytes) * 100);
              return (
                <div
                  key={layer.id}
                  style={{ width: `${pct}%`, backgroundColor: layer.color, color: layer.textColor }}
                  title={`${layer.name} (${layer.bytes} B): ${layer.summary}`}
                  className="flex items-center justify-center px-1 text-[10px] font-mono font-semibold border-r border-white/25 last:border-r-0 truncate"
                >
                  {layer.name.split(' ')[0]}
                </div>
              );
            })}
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {currentStep.layers.map((layer) => (
              <div
                key={layer.id}
                className="border border-slate-200 dark:border-slate-700 rounded-md p-2 bg-slate-50/60 dark:bg-slate-800/60"
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="font-semibold text-slate-900 dark:text-white">{layer.name}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{layer.osiLayer}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    {layer.bytes} B
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-0.5 text-[11px]">
                  {layer.fields.map((f, idx) => (
                    <div key={idx} className="flex items-baseline justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">{f.label}:</span>
                      <span
                        className={`font-mono text-right truncate ${
                          f.highlight
                            ? 'font-bold text-sky-800 dark:text-sky-300'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Enlace</div>
              <div
                className="font-mono font-semibold text-slate-900 dark:text-white truncate"
                title={currentStep.metrics.linkName}
              >
                {currentStep.metrics.linkName}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Trama total</div>
              <div className="font-display text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {currentStep.metrics.totalFrameBytes} B
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Overhead L2</div>
              <div className="font-display text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {currentStep.metrics.overheadL2Bytes} B
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Eficiencia</div>
              <div className="font-display text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {currentStep.metrics.efficiencyPct}%
              </div>
            </div>
            <div
              className={`border rounded p-2 ${
                currentStep.metrics.mtuExceeded
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>MTU enlace</span>
                {currentStep.metrics.mtuExceeded && (
                  <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                )}
              </div>
              <div
                className={`font-display text-base font-bold tabular-nums ${
                  currentStep.metrics.mtuExceeded
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {currentStep.metrics.mtuBytes} B {currentStep.metrics.mtuExceeded ? 'EXCEDIDA' : ''}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Serialización</div>
              <div className="font-display text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {currentStep.metrics.serializationUs} µs
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-3.5 shadow-xs">
          <div className="mb-2">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white leading-tight">
              {currentStep.contextualState.title}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {currentStep.contextualState.subtitle}
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-md">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {currentStep.contextualState.columns.map((col) => (
                    <th key={col} className="px-2 py-1.5 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                {currentStep.contextualState.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    {row.cells.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-2 py-1.5 font-mono tabular-nums ${
                          cIdx === row.cells.length - 1 && row.status === 'err'
                            ? 'text-rose-700 dark:text-rose-400 font-semibold'
                            : cIdx === row.cells.length - 1 && row.status === 'warn'
                            ? 'text-amber-700 dark:text-amber-400 font-semibold'
                            : cIdx === row.cells.length - 1 && row.status === 'ok'
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {cIdx === row.cells.length - 1 && row.status === 'err' && (
                          <ShieldAlert className="w-3 h-3 inline mr-1 -mt-0.5 text-rose-600 dark:text-rose-400" />
                        )}
                        {cIdx === row.cells.length - 1 && row.status === 'ok' && (
                          <CheckCircle2 className="w-3 h-3 inline mr-1 -mt-0.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-[#0B1120] border border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Consola Syslog (Cisco IOS)</span>
            </div>
            <button
              type="button"
              onClick={() => setSyslogHistory([currentStep.syslog])}
              className="text-[11px] font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Limpiar
            </button>
          </div>
          <div className="p-3 h-40 overflow-y-auto console-scroll font-mono text-[11px] leading-relaxed space-y-1.5">
            {syslogHistory.map((log, i) => (
              <div key={`${log.timestamp}-${i}`} className="text-slate-300">
                <span className="text-slate-500">*{log.timestamp}</span>{' '}
                <span className="text-sky-400 font-semibold">[{log.device}]</span>{' '}
                <span
                  className={
                    log.severity <= 3
                      ? 'text-rose-400 font-semibold'
                      : log.severity === 4
                      ? 'text-amber-400 font-semibold'
                      : 'text-emerald-400 font-semibold'
                  }
                >
                  %{log.facility}-{log.severity}-{log.mnemonic}:
                </span>{' '}
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};
