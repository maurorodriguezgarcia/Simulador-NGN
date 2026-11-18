import React, { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Layers, Shield, Zap } from 'lucide-react';
import { InfraDesign, ScenarioId, WanArchitecture } from '../types/network';

interface MatrixTabProps {
  design: InfraDesign;
  activeWanArch: WanArchitecture;
  onSelectWanArch: (arch: WanArchitecture) => void;
  onJumpToScenario: (id: ScenarioId) => void;
}

export const MatrixTab: React.FC<MatrixTabProps> = ({
  design,
  activeWanArch,
  onSelectWanArch,
  onJumpToScenario,
}) => {
  const designSummary = useMemo(() => {
    const byTech = (tech: WanArchitecture) => {
      const list = design.sites.filter((s) => s.technology === tech);
      const cap = list.reduce((a, s) => a + s.capacityMbps, 0);
      const users = list.reduce((a, s) => a + s.users, 0);
      return { count: list.length, capacityMbps: cap, users };
    };
    return {
      metroethernet: byTech('metroethernet'),
      mpls: byTech('mpls'),
      gpon: byTech('gpon'),
    };
  }, [design]);

  const rows: {
    id: WanArchitecture;
    name: string;
    standard: string;
    osiLayer: string;
    operation: string;
    overheadBytes: number;
    overheadPct: number;
    mtuBytes: number;
    mssBytes: number;
    benefits: string;
    simBehavior: string;
    scenarioId: ScenarioId;
    accent: string;
  }[] = [
    {
      id: 'metroethernet',
      name: 'MetroEthernet (E-Line / E-LAN)',
      standard: 'IEEE 802.1ad (Q-in-Q) · MEF 3.0',
      osiLayer: 'Capa 2 (Enlace de Datos)',
      operation:
        'Transporte Ethernet nativo punto a punto o multipunto sobre anillos ópticos del operador con doble etiqueta VLAN (S-VLAN / C-VLAN).',
      overheadBytes: 22,
      overheadPct: 1.5,
      mtuBytes: 1500,
      mssBytes: 1460,
      benefits:
        'Muy baja latencia (< 5 ms metro), simplicidad operativa L2, alta eficiencia de trama (98.5%) y soporte nativo hasta 10/100 Gbps.',
      simBehavior:
        'En el simulador opera con tramas 802.1Q limpias sin encapsulación PPPoE ni sobrecarga ESP, ideal para Datacenters y sedes troncales.',
      scenarioId: 'hsrp',
      accent: '#0284C7',
    },
    {
      id: 'mpls',
      name: 'MPLS L3VPN (LDP + MP-BGP)',
      standard: 'RFC 3031 · RFC 4364 · RFC 4090 (FRR)',
      osiLayer: 'Capa 2.5 (Shim Header entre L2 y L3)',
      operation:
        'Conmutación rápida de etiquetas de 32 bits en routers P, aislamiento por VRF en PE vía MP-BGP VPNv4 y respaldo TE-FRR ante cortes.',
      overheadBytes: 26,
      overheadPct: 1.7,
      mtuBytes: 1500,
      mssBytes: 1460,
      benefits:
        'Aislamiento L3 seguro entre clientes/sedes, ingeniería de tráfico, mapeo QoS EXP=5 y reconvergencia < 50 ms con Fast Reroute.',
      simBehavior:
        'Impone doble etiqueta [LDP | VPN] en PE-01, realiza Swap en P-01, PHP Pop en egreso y desvía en 34 ms al simular corte de fibra.',
      scenarioId: 'mpls',
      accent: '#7C3AED',
    },
    {
      id: 'gpon',
      name: 'GPON FTTH (PPPoE + IPsec)',
      standard: 'ITU-T G.984 · RFC 2516 (PPPoE)',
      osiLayer: 'Capa 1–2 (PON Óptica + GEM + PPPoE)',
      operation:
        'Red óptica pasiva punto-multipunto desde OLT hacia ONTs mediante Splitter 1:16/1:32, T-CONT DBA y sesión PPPoE con túnel GRE/IPsec.',
      overheadBytes: design.policies.ipsecOnGpon ? 107 : 31,
      overheadPct: design.policies.ipsecOnGpon ? 7.1 : 2.1,
      mtuBytes: design.policies.ipsecOnGpon ? 1400 : 1492,
      mssBytes: design.policies.ipsecOnGpon ? 1360 : 1452,
      benefits:
        'Máxima capilaridad última milla y menor costo por sede regional; T-CONT Tipo 1 garantiza ancho de banda fijo para voz/telemedicina.',
      simBehavior:
        'Reduce MTU útil a 1492 B (PPPoE) o 1400 B (con IPsec ESP), activando alertas si no se habilita ajuste TCP MSS 1452 / 1360 B.',
      scenarioId: 'vpn',
      accent: '#059669',
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-5 space-y-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-lg p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Matriz Comparativa de Transporte WAN
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Comparación técnica entre MetroEthernet, MPLS L3VPN y GPON FTTH sincronizada con el diseño activo ({design.orgName}).
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <Layers className="w-4 h-4 text-sky-700 dark:text-sky-400" />
            <span>Arquitectura global seleccionada:</span>
            <strong className="font-mono uppercase text-slate-900 dark:text-white">{activeWanArch}</strong>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-xs text-left align-top">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3.5 py-3 w-48">Tecnología WAN</th>
                <th className="px-3.5 py-3 w-48">Estándar y Capa OSI</th>
                <th className="px-3.5 py-3 w-64">Operación Técnica</th>
                <th className="px-3.5 py-3 w-52">Overhead y MTU / MSS</th>
                <th className="px-3.5 py-3 w-56">Beneficios Clave</th>
                <th className="px-3.5 py-3 w-56">Comportamiento en Simulador</th>
                <th className="px-3.5 py-3 w-44">Diseño Activo ({design.sites.length} sedes)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {rows.map((r) => {
                const stats = designSummary[r.id];
                const isActive = activeWanArch === r.id;
                const mtuPct = Math.round((r.mtuBytes / 1500) * 100);
                const mssPct = Math.round((r.mssBytes / 1500) * 100);
                const ohBarPct = Math.min(100, Math.round((r.overheadBytes / 120) * 100));

                return (
                  <tr
                    key={r.id}
                    className={
                      isActive
                        ? 'bg-sky-50/60 dark:bg-sky-950/35'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                    }
                  >
                    <td className="px-3.5 py-3.5">
                      <div className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {r.name}
                      </div>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onSelectWanArch(r.id)}
                        className={`mt-2 px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-slate-900 border-slate-900 text-white dark:bg-sky-600 dark:border-sky-500'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {isActive ? 'Arquitectura activa' : 'Activar en simulador'}
                      </button>
                    </td>

                    <td className="px-3.5 py-3.5">
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {r.standard}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        {r.osiLayer}
                      </div>
                    </td>

                    <td className="px-3.5 py-3.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                      {r.operation}
                    </td>

                    <td className="px-3.5 py-3.5 space-y-2.5">
                      <div>
                        <div className="flex justify-between text-[11px] font-mono mb-0.5">
                          <span className="text-slate-600 dark:text-slate-400">Overhead</span>
                          <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                            {r.overheadBytes} B ({r.overheadPct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${ohBarPct}%`, backgroundColor: r.accent }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-mono mb-0.5">
                          <span className="text-slate-600 dark:text-slate-400">MTU / MSS</span>
                          <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                            {r.mtuBytes} / {r.mssBytes} B
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                          <div
                            className="h-full bg-slate-300 dark:bg-slate-600"
                            style={{ width: `${mtuPct}%` }}
                          />
                          <div
                            className="h-full absolute top-0 left-0"
                            style={{ width: `${mssPct}%`, backgroundColor: r.accent }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-3.5 py-3.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                      <div className="flex items-start gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{r.benefits}</span>
                      </div>
                    </td>

                    <td className="px-3.5 py-3.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                      <div>{r.simBehavior}</div>
                      <button
                        type="button"
                        onClick={() => onJumpToScenario(r.scenarioId)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        <span>Ver en escenario</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>

                    <td className="px-3.5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40">
                      <div className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                        {stats.count} {stats.count === 1 ? 'sede' : 'sedes'}
                      </div>
                      <div className="font-mono text-xs font-semibold text-sky-800 dark:text-sky-300 tabular-nums mt-0.5">
                        {stats.capacityMbps.toLocaleString()} Mbps
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {stats.users.toLocaleString()} usuarios
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Dynamic Synchronized Totals Row */}
              <tr className="bg-slate-900 dark:bg-slate-950 text-white font-semibold border-t border-slate-700">
                <td colSpan={3} className="px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-sky-400" />
                    <span>Resumen sincronizado del diseño activo ({design.orgName})</span>
                  </div>
                </td>
                <td colSpan={3} className="px-3.5 py-3 font-mono text-xs text-slate-300">
                  MetroEthernet: {designSummary.metroethernet.count} sedes ({designSummary.metroethernet.capacityMbps} Mbps) ·{' '}
                  MPLS: {designSummary.mpls.count} sedes ({designSummary.mpls.capacityMbps} Mbps) ·{' '}
                  GPON: {designSummary.gpon.count} sedes ({designSummary.gpon.capacityMbps} Mbps)
                </td>
                <td className="px-3.5 py-3 font-display text-base tabular-nums text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {(
                      designSummary.metroethernet.capacityMbps +
                      designSummary.mpls.capacityMbps +
                      designSummary.gpon.capacityMbps
                    ).toLocaleString()}{' '}
                    Mbps
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
