import React, { useMemo, useRef, useState } from 'react';
import { Bot, Send, Sparkles, Terminal, X } from 'lucide-react';
import {
  DesignValidationIssue,
  FaultInjection,
  InfraDesign,
  N1ContingencyScenario,
  OpexEstimate,
  SiteHourlyMetrics,
  SiteNode,
} from '../types/network';
import { calculateCgnatOffload } from '../engine/vlsm';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  design: InfraDesign;
  activeHour: number;
  faults: FaultInjection;
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
  sedeA: SiteNode;
  sedeB: SiteNode;
  sedeC: SiteNode;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  title?: string;
  body: string;
  commands?: string[];
}

function generateCopilotResponse(
  query: string,
  design: InfraDesign,
  activeHour: number,
  faults: FaultInjection,
  evaluation: CopilotDrawerProps['evaluation'],
  sedeA: SiteNode,
  sedeB: SiteNode,
  sedeC: SiteNode
): { title: string; body: string; commands?: string[] } {
  const q = query.toLowerCase();
  const hourStr = `${String(activeHour).padStart(2, '0')}:00`;
  const cgnat = calculateCgnatOffload(design);

  // 1. SLA / Hora pico / Saturación
  if (
    q.includes('sla') ||
    q.includes('pico') ||
    q.includes('incumpl') ||
    q.includes('satur') ||
    q.includes('solucion')
  ) {
    const failing = evaluation.siteMetrics.filter((m) => !m.slaCompliant);
    const warnings = evaluation.siteMetrics.filter((m) => m.status === 'warning');
    const opticalAlerts = evaluation.siteMetrics.filter(
      (m) => m.opticalBudget && m.opticalBudget.status !== 'ok'
    );

    if (failing.length === 0 && warnings.length === 0) {
      return {
        title: `Estado SLA Nominal a las ${hourStr} (${evaluation.globalSlaPct.toFixed(3)}%)`,
        body: `Todas las ${evaluation.totalSites} sedes de "${design.orgName}" cumplen el SLA (${design.policies.slaLatencyVoiceMs} ms voz / ${design.policies.slaLossPct}% pérdida). Demanda agregada: ${evaluation.totalDemandMbps.toFixed(0)} / ${evaluation.totalCapacityMbps} Mbps. La hora pico proyectada es ${String(evaluation.peakHour).padStart(2, '0')}:00 h.`,
        commands: [
          `show policy-map interface GigabitEthernet0/1`,
          `show ip sla statistics`,
        ],
      };
    }

    const failLines = failing.map((m) => {
      const peak = Math.max(...m.hourlySeries);
      const optNote =
        m.opticalBudget && m.opticalBudget.status !== 'ok'
          ? ` | Óptica ODN: ${m.opticalBudget.ontRxDbm} dBm (${m.opticalBudget.status === 'low_signal' ? 'bajo -27 dBm' : 'saturación > -8 dBm'})`
          : '';
      return `• ${m.siteName} (${m.city}): Uso ${m.utilizationPct}%, Latencia ${m.latencyMs} ms, Pico 24h ${peak.toFixed(0)} Mbps / Cap ${m.capacityMbps} Mbps${optNote}`;
    });

    return {
      title: `${failing.length} sedes fuera de SLA y ${warnings.length} en advertencia (${hourStr})`,
      body:
        `${failLines.join('\n')}\n\nAcción recomendada: ` +
        (!design.policies.qosEnabled
          ? '1) Activar QoS DiffServ (LLQ EF + CBWFQ + WRED) inmediatamente. '
          : '') +
        (opticalAlerts.length > 0
          ? `2) Corregir planta externa GPON en ${opticalAlerts.map((o) => o.city).join(', ')} (migrar a OLT C+ o splitter 1:16). `
          : '') +
        `3) Escalar capacidad WAN en sedes con utilización >85% o habilitar salida local a Internet.`,
      commands: [
        `show policy-map interface Dialer1`,
        `show interfaces gpon-olt_1/1/1 optical-info`,
        `show mpls traffic-eng tunnels brief`,
      ],
    };
  }

  // 2. Falla activa y comandos show
  if (q.includes('falla') || q.includes('show') || q.includes('diagnost') || q.includes('verific')) {
    const activeFaultList: string[] = [];
    if (faults.cutSiteId) {
      const s = design.sites.find((x) => x.id === faults.cutSiteId);
      activeFaultList.push(`Enlace cortado en ${s?.name || faults.cutSiteId} (${s?.city})`);
    }
    if (faults.centralInternetDown) activeFaultList.push('Salida Internet Central (Datacenter) caída');
    if (faults.primaryRouterDown)
      activeFaultList.push(
        `R-BORDE-A apagado (${design.policies.hsrpEnabled ? 'Conmutado vía HSRP a R-BORDE-B' : 'SIN HSRP -> corte total'})`
      );
    if (faults.coreFiberCut)
      activeFaultList.push(
        `Corte de fibra núcleo MPLS (${design.policies.frrEnabled ? 'MPLS TE-FRR activo <50 ms' : 'Sin FRR -> pérdida 4.2%'})`
      );

    if (activeFaultList.length === 0) {
      return {
        title: 'Sin fallas inyectadas en el escenario actual',
        body: `No hay cortes activos a las ${hourStr}. Servicios asignados: Sede A (${sedeA.city}), Sede B (${sedeB.city}), Sede C (${sedeC.city}). Puedes usar el Inyector de Fallas en Diseño Paramétrico o los botones de falla HSRP/MPLS en Simulación para probar la convergencia.`,
        commands: [
          `show standby brief`,
          `show mpls ldp neighbor`,
          `show ip dhcp snooping binding`,
          `show crypto ipsec sa`,
        ],
      };
    }

    return {
      title: `Diagnóstico de ${activeFaultList.length} falla(s) activa(s)`,
      body: `Fallas detectadas:\n• ${activeFaultList.join('\n• ')}\n\nImpacto medido: SLA Global ${evaluation.globalSlaPct.toFixed(3)}%, ${evaluation.sitesInSla}/${evaluation.totalSites} sedes conformes, latencia promedio ${evaluation.avgLatencyMs} ms.`,
      commands: [
        `show track 1`,
        `show standby brief`,
        `show mpls traffic-eng fast-reroute database`,
        `show ip route vrf VRF-NGN-CORP`,
      ],
    };
  }

  // 3. Contingencia N-1 / MPLS / DiffServ-TE / Migración
  if (q.includes('n-1') || q.includes('mpls') || q.includes('migra') || q.includes('contingencia') || q.includes('te')) {
    const worst = evaluation.n1Matrix[1] || evaluation.n1Matrix[0];
    const summaryLines = evaluation.n1Matrix.map(
      (n) =>
        `• ${n.title}: Uso respaldo ${n.backupUtilizationPct}% | Voz EF: ${n.criticalEfPreserved ? 'Preservada' : 'Degradada'} | Drop Best Effort: ${n.bestEffortDropPct}% (${n.failoverMs} ms)`
    );
    return {
      title: 'Análisis de Resiliencia N-1 y DiffServ-TE en Hora Pico',
      body: `${summaryLines.join('\n')}\n\nConclusión de ingeniería: ${
        worst.criticalEfPreserved
          ? 'DiffServ-TE protege voz EF y tráfico corporativo AF durante contingencia N-1 absorbiendo congestión únicamente en Best Effort.'
          : 'Riesgo de saturación crítica en respaldo N-1. Activar QoS + TE-FRR y ampliar capacidad del enlace de agregación.'
      }`,
      commands: [
        `show mpls traffic-eng topology`,
        `show mpls traffic-eng ds-te`,
        `show policy-map interface Tunnel50`,
      ],
    };
  }

  // 4. GPON ODN / Óptico / IPv6 / CGNAT / OPEX
  if (q.includes('gpon') || q.includes('óptic') || q.includes('optic') || q.includes('dbm') || q.includes('ipv6') || q.includes('cgnat') || q.includes('opex')) {
    const gponSites = evaluation.siteMetrics.filter((m) => m.opticalBudget);
    const badOpt = gponSites.filter((m) => m.opticalBudget?.status !== 'ok');
    return {
      title: 'Auditoría Óptica GPON ODN, Dual-Stack IPv6 y OPEX',
      body:
        `• Sedes GPON analizadas: ${gponSites.length} (${badOpt.length} con alerta óptica fuera de [-27, -8] dBm).\n` +
        gponSites
          .slice(0, 4)
          .map(
            (g) =>
              `  - ${g.city}: Rx ${g.opticalBudget!.ontRxDbm} dBm | Margen ${g.opticalBudget!.marginDb} dB (${g.opticalBudget!.splitterRatio}, ${g.opticalBudget!.distanceKm} km, Clase ${g.opticalBudget!.opticalClass})`
          )
          .join('\n') +
        `\n• IPv6 Dual-Stack (${cgnat.ipv6OffloadPct}% adopción): reduce sesiones CGNAT a ${cgnat.remainingIpv4Sessions.toLocaleString()} (ahorra ${cgnat.publicIpsSaved} IPs públicas IPv4).\n• OPEX Mensual estimado: $${evaluation.opex.totalMonthlyUsd.toLocaleString()} USD/mes (evita $${evaluation.opex.slaPenaltyAvoidedUsd.toLocaleString()} USD en créditos SLA).`,
      commands: [
        `show pon power onu-rx gpon-olt_1/1/1`,
        `show ip nat statistics`,
        `show ipv6 dhcp pool`,
      ],
    };
  }

  // Default intelligent summary
  return {
    title: `Resumen Operativo NOC — ${design.orgName} (${hourStr})`,
    body: `• SLA Global: ${evaluation.globalSlaPct.toFixed(3)}% (${evaluation.sitesInSla}/${evaluation.totalSites} sedes OK)\n• Demanda actual: ${evaluation.totalDemandMbps.toFixed(0)} / ${evaluation.totalCapacityMbps} Mbps · Latencia media: ${evaluation.avgLatencyMs} ms\n• OPEX mensual: $${evaluation.opex.totalMonthlyUsd.toLocaleString()} USD · Adopción IPv6: ${cgnat.ipv6OffloadPct}% (${cgnat.publicIpsSaved} IPv4 ahorradas)\n• Validaciones detectadas: ${evaluation.validations.length}\n\nPregúntame sobre: incumplimientos SLA en hora pico, comandos show de falla activa, matriz N-1 DiffServ-TE o presupuesto óptico GPON/IPv6.`,
    commands: [`show ip interface brief`, `show standby brief`, `show mpls ldp bindings`],
  };
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  design,
  activeHour,
  faults,
  evaluation,
  sedeA,
  sedeB,
  sedeC,
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      title: 'Copiloto NOC ISP en línea',
      body: `Conectado en tiempo real a "${design.orgName}" (${evaluation.totalSites} sedes · ${String(activeHour).padStart(2, '0')}:00 h). Selecciona un diagnóstico rápido o escribe tu consulta técnica.`,
      commands: ['show ip sla summary', 'show mpls ldp neighbor'],
    },
  ]);

  const listRef = useRef<HTMLDivElement | null>(null);

  const quickPrompts = useMemo(
    () => [
      '¿Qué sedes incumplen SLA en hora pico y cómo solucionarlo?',
      'Diagnóstico de falla activa y comandos show de verificación',
      'Análisis de capacidad N-1 y migración tecnológica',
      'Auditoría óptica GPON ODN y ahorro CGNAT IPv6',
    ],
    []
  );

  const sendQuery = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      body: trimmed,
    };
    const reply = generateCopilotResponse(
      trimmed,
      design,
      activeHour,
      faults,
      evaluation,
      sedeA,
      sedeB,
      sedeC
    );
    const botMsg: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      role: 'assistant',
      title: reply.title,
      body: reply.body,
      commands: reply.commands,
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Copiloto NOC ISP"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-300 dark:border-slate-700 shadow-2xl flex flex-col no-print"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-sky-600/20 border border-sky-500/40 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 text-sky-400" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold leading-none">Copiloto NOC ISP</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Telemetría en vivo · {String(activeHour).padStart(2, '0')}:00 h · SLA {evaluation.globalSlaPct.toFixed(2)}%
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar Copiloto NOC"
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Quick Prompt Chips */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>Diagnósticos rápidos conectados al modelo</span>
        </div>
        <div className="flex flex-col gap-1">
          {quickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => sendQuery(qp)}
              className="text-left px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              {qp}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Feed */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 console-scroll">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg p-3 text-xs ${
              m.role === 'user'
                ? 'bg-sky-700 text-white ml-8'
                : 'bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 mr-4'
            }`}
          >
            {m.title && (
              <div className="font-display text-sm font-bold text-slate-900 dark:text-white mb-1">
                {m.title}
              </div>
            )}
            <div className="whitespace-pre-line leading-relaxed">{m.body}</div>
            {m.commands && m.commands.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> Comandos de verificación IOS:
                </div>
                {m.commands.map((cmd, idx) => (
                  <div
                    key={idx}
                    className="font-mono text-[11px] px-2 py-1 rounded bg-slate-900 text-emerald-300 border border-slate-700"
                  >
                    # {cmd}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendQuery(input);
        }}
        className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Consulta sobre SLA, ODN, N-1, CGNAT o CLI..."
          className="flex-1 px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-600/40"
        />
        <button
          type="submit"
          aria-label="Enviar consulta al Copiloto NOC"
          className="p-2 rounded-md bg-sky-700 hover:bg-sky-600 text-white transition-colors cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
