import {
  DesignValidationIssue,
  FaultInjection,
  GponOpticalBudget,
  GponOpticalClass,
  GponSplitterRatio,
  InfraDesign,
  N1ContingencyScenario,
  OpexEstimate,
  SiteHourlyMetrics,
  SiteNode,
  WanArchitecture,
} from '../types/network';
import { calculateCgnatOffload } from './vlsm';

function getHourlyFactor(presetId: InfraDesign['presetId'], hour: number): number {
  const univCurve = [
    0.12, 0.09, 0.08, 0.07, 0.08, 0.14, 0.32, 0.56, 0.74, 0.82, 0.86, 0.81,
    0.72, 0.78, 0.84, 0.85, 0.83, 0.88, 0.94, 0.98, 0.91, 0.68, 0.38, 0.20,
  ];
  const corpCurve = [
    0.10, 0.08, 0.07, 0.07, 0.09, 0.16, 0.35, 0.68, 0.89, 0.96, 0.98, 0.92,
    0.74, 0.86, 0.95, 0.97, 0.91, 0.72, 0.45, 0.28, 0.19, 0.15, 0.12, 0.11,
  ];
  const ispCurve = [
    0.34, 0.22, 0.15, 0.12, 0.11, 0.14, 0.25, 0.42, 0.55, 0.62, 0.65, 0.68,
    0.72, 0.70, 0.69, 0.73, 0.78, 0.85, 0.93, 0.97, 1.00, 0.95, 0.78, 0.54,
  ];
  const h = ((hour % 24) + 24) % 24;
  if (presetId === 'universidad') return univCurve[h];
  if (presetId === 'empresa') return corpCurve[h];
  return ispCurve[h];
}

function getOverheadMultiplier(tech: WanArchitecture, ipsecOnGpon: boolean): number {
  if (tech === 'metroethernet') return 1.04;
  if (tech === 'mpls') return 1.08;
  return ipsecOnGpon ? 1.19 : 1.09;
}

function getBaseLatencyMs(tech: WanArchitecture, distanceKm: number, ipsecOnGpon: boolean): number {
  const propagation = distanceKm * 0.011;
  if (tech === 'metroethernet') return 3.2 + propagation;
  if (tech === 'mpls') return 5.8 + propagation * 1.15;
  return (ipsecOnGpon ? 11.4 : 8.2) + propagation * 1.1;
}

const SPLITTER_LOSS_DB: Record<GponSplitterRatio, number> = {
  '1:8': 10.5,
  '1:16': 13.8,
  '1:32': 17.2,
  '1:64': 20.5,
};

export function calculateGponOpticalBudget(site: SiteNode): GponOpticalBudget | undefined {
  if (site.technology !== 'gpon') return undefined;
  const opticalClass: GponOpticalClass = site.gponOpticalClass || 'B+';
  const splitterRatio: GponSplitterRatio = site.splitterRatio || '1:32';
  const oltTxDbm = opticalClass === 'C+' ? 5.0 : 3.0;
  const splitterLossDb = SPLITTER_LOSS_DB[splitterRatio];
  // Typical ODN distance capped reasonably if user hasn't edited, or real site.distanceKm
  const fiberLossDb = Number((site.distanceKm * 0.35).toFixed(2));
  const connectorLossDb = 1.8; // 2 connectors + 4 fusion splices
  const totalAttenuationDb = Number((splitterLossDb + fiberLossDb + connectorLossDb).toFixed(2));
  const ontRxDbm = Number((oltTxDbm - totalAttenuationDb).toFixed(2));

  // Sensitivity threshold requested: < -27 dBm alert, > -8 dBm saturation
  const sensitivityFloorDbm = -27.0;
  const saturationCeilingDbm = -8.0;
  const marginDb = Number((ontRxDbm - sensitivityFloorDbm).toFixed(2));

  let status: GponOpticalBudget['status'] = 'ok';
  if (ontRxDbm < sensitivityFloorDbm) {
    status = 'low_signal';
  } else if (ontRxDbm > saturationCeilingDbm) {
    status = 'saturation';
  }

  return {
    siteId: site.id,
    siteName: site.name,
    city: site.city,
    opticalClass,
    splitterRatio,
    distanceKm: site.distanceKm,
    oltTxDbm,
    splitterLossDb,
    fiberLossDb,
    connectorLossDb,
    totalAttenuationDb,
    ontRxDbm,
    sensitivityFloorDbm,
    saturationCeilingDbm,
    marginDb,
    status,
  };
}

export function calculateOpex(
  design: InfraDesign,
  globalSlaPct: number,
  sitesInSla: number,
  totalSites: number
): OpexEstimate {
  let metroMbps = 0;
  let mplsMbps = 0;
  let gponMbps = 0;

  design.sites.forEach((s) => {
    if (s.technology === 'metroethernet') metroMbps += s.capacityMbps;
    else if (s.technology === 'mpls') mplsMbps += s.capacityMbps;
    else gponMbps += s.capacityMbps;
  });

  // Realistic monthly USD ISP cost benchmarks per Mbps
  const metroCostUsd = Math.round(metroMbps * 1.45);
  const mplsCostUsd = Math.round(mplsMbps * 2.15);
  const gponCostUsd = Math.round(gponMbps * 0.72);
  const radioBackupCostUsd = Math.round(design.sites.length * 140); // LTE/Microwave management backup
  const totalCap = metroMbps + mplsMbps + gponMbps;
  const ipTransitCostUsd = Math.round(totalCap * 0.48);

  const cgnat = calculateCgnatOffload(design);
  const ipUnitMonthlyUsd = 1.85;
  const publicIpAndCgnatCostUsd = Math.round(cgnat.publicIpsWithIpv6 * ipUnitMonthlyUsd + 180);
  const cgnatSavingsIpv6Usd = Math.round(cgnat.publicIpsSaved * ipUnitMonthlyUsd * 12); // annualized/pool lease value

  const totalMonthlyUsd =
    metroCostUsd +
    mplsCostUsd +
    gponCostUsd +
    radioBackupCostUsd +
    ipTransitCostUsd +
    publicIpAndCgnatCostUsd;

  // Contractual SLA credit avoidance estimate (10% of MRC at risk when SLA < 99.5%)
  const slaPenaltyAvoidedUsd =
    globalSlaPct >= 99.5 && sitesInSla === totalSites
      ? Math.round(totalMonthlyUsd * 0.12)
      : 0;

  return {
    metroCostUsd,
    mplsCostUsd,
    gponCostUsd,
    radioBackupCostUsd,
    ipTransitCostUsd,
    publicIpAndCgnatCostUsd,
    totalMonthlyUsd,
    slaPenaltyAvoidedUsd,
    cgnatSavingsIpv6Usd,
  };
}

export function evaluateN1Contingency(
  design: InfraDesign,
  siteMetrics: SiteHourlyMetrics[]
): N1ContingencyScenario[] {
  const peakDemands = siteMetrics.map((m) => Math.max(...m.hourlySeries));
  const totalPeakDemand = peakDemands.reduce((a, b) => a + b, 0);
  const remotesPeakDemand = siteMetrics
    .filter((_, idx) => !design.sites[idx]?.isPrimaryHub)
    .reduce((a, m) => a + Math.max(...m.hourlySeries), 0);

  const voiceRatio =
    design.appDemands.voiceKbpsPerUser /
    Math.max(
      1,
      design.appDemands.voiceKbpsPerUser +
        design.appDemands.videoKbpsPerUser +
        design.appDemands.erpKbpsPerUser +
        design.appDemands.webKbpsPerUser
    );
  const corpRatio =
    (design.appDemands.videoKbpsPerUser + design.appDemands.erpKbpsPerUser) /
    Math.max(
      1,
      design.appDemands.voiceKbpsPerUser +
        design.appDemands.videoKbpsPerUser +
        design.appDemands.erpKbpsPerUser +
        design.appDemands.webKbpsPerUser
    );

  const hubCap = design.sites.find((s) => s.isPrimaryHub)?.capacityMbps || 2000;
  const diffServTeActive = design.policies.qosEnabled && design.policies.frrEnabled;

  const scenariosInput = [
    {
      id: 'n1-pe1-p1',
      title: 'Corte Troncal MPLS PE-01 ↔ P-01 (Hora Pico)',
      failedElement: 'Fibra Troncal Primaria PE-01 ↔ P-01',
      backupPath: 'Túnel TE-FRR Backup vía P-02 (Anillo Secundario)',
      backupCap: Math.round(hubCap * 0.72),
      rerouted: Math.round(remotesPeakDemand * 0.68),
      failoverMs: design.policies.frrEnabled ? 34 : 1850,
    },
    {
      id: 'n1-pe-node',
      title: 'Falla Completa de Router PE-01 de Agregación',
      failedElement: 'Chasis Router PE-01 (MPLS L3VPN + BNG)',
      backupPath: 'PE-02 Redundante + Dual-Homing BGP/LDP',
      backupCap: Math.round(hubCap * 0.65),
      rerouted: Math.round(remotesPeakDemand * 0.85),
      failoverMs: design.policies.frrEnabled ? 46 : 3200,
    },
    {
      id: 'n1-metro-ring',
      title: 'Corte Anillo MetroEthernet Principal (DC ↔ Nodos)',
      failedElement: 'Enlace 10GE MetroEthernet Primario Datacenter',
      backupPath: 'Borde HSRP R-BORDE-B + Camino Alterno Anillo',
      backupCap: Math.round(hubCap * 0.8),
      rerouted: Math.round(totalPeakDemand * 0.55),
      failoverMs: design.policies.hsrpEnabled ? 750 : 9500,
    },
    {
      id: 'n1-dc-border',
      title: 'Caída Router de Borde Primario R-BORDE-A',
      failedElement: 'R-BORDE-A (Gateway VIP HSRP + NAT)',
      backupPath: 'R-BORDE-B Standby → Active (Object Tracking)',
      backupCap: Math.round(hubCap * 0.9),
      rerouted: Math.round(totalPeakDemand * 0.62),
      failoverMs: design.policies.hsrpEnabled ? 18 : 10000,
    },
  ];

  return scenariosInput.map((sc) => {
    const util = Number(((sc.rerouted / Math.max(1, sc.backupCap)) * 100).toFixed(1));
    const criticalShare = voiceRatio + corpRatio;
    const criticalDemand = sc.rerouted * criticalShare;
    const criticalFits = criticalDemand <= sc.backupCap * 0.92;

    const criticalEfPreserved = diffServTeActive
      ? sc.rerouted * voiceRatio <= sc.backupCap * 0.45
      : util < 88;
    const corpAfPreserved = diffServTeActive ? criticalFits : util < 85;

    let bestEffortDropPct = 0;
    if (util > 100) {
      const excessMbps = sc.rerouted - sc.backupCap;
      const beMbps = Math.max(1, sc.rerouted * (1 - criticalShare));
      bestEffortDropPct = diffServTeActive
        ? Math.min(100, Number(((excessMbps / beMbps) * 100).toFixed(1)))
        : Math.min(100, Number(((excessMbps / sc.rerouted) * 100).toFixed(1)));
    } else if (util > 85 && diffServTeActive) {
      bestEffortDropPct = Number(((util - 85) * 0.6).toFixed(1));
    }

    let verdict: N1ContingencyScenario['verdict'] = 'resilient';
    if (!criticalEfPreserved || !corpAfPreserved) {
      verdict = 'saturated';
    } else if (util > 92 || bestEffortDropPct > 0) {
      verdict = 'degraded_be';
    }

    return {
      id: sc.id,
      title: sc.title,
      failedElement: sc.failedElement,
      backupPath: sc.backupPath,
      backupCapacityMbps: sc.backupCap,
      reroutedDemandMbps: sc.rerouted,
      backupUtilizationPct: util,
      diffServTeActive,
      criticalEfPreserved,
      corpAfPreserved,
      bestEffortDropPct,
      failoverMs: sc.failoverMs,
      verdict,
    };
  });
}

export function evaluateDesignAtHour(
  design: InfraDesign,
  hour: number,
  faults: FaultInjection
): {
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
} {
  const totalAppKbpsPerUser =
    design.appDemands.voiceKbpsPerUser +
    design.appDemands.videoKbpsPerUser +
    design.appDemands.erpKbpsPerUser +
    design.appDemands.webKbpsPerUser;

  const siteMetrics: SiteHourlyMetrics[] = design.sites.map((site, idx) => {
    const overhead = getOverheadMultiplier(site.technology, design.policies.ipsecOnGpon);
    const sitePeakVariation = 0.88 + ((idx * 7) % 19) * 0.01;
    const hourlySeries: number[] = [];

    for (let h = 0; h < 24; h++) {
      const factor = getHourlyFactor(design.presetId, h);
      const rawMbps = (site.users * totalAppKbpsPerUser * factor * sitePeakVariation) / 1000;
      const hubMultiplier = site.isPrimaryHub ? 2.1 : 1.0;
      const internetFactor =
        design.policies.internetExit === 'central' && !site.isPrimaryHub ? 1.12 : 1.0;
      hourlySeries.push(Number((rawMbps * overhead * hubMultiplier * internetFactor).toFixed(1)));
    }

    let demandMbps = hourlySeries[((hour % 24) + 24) % 24];
    const isDown = faults.cutSiteId === site.id;

    if (faults.centralInternetDown && site.isPrimaryHub && design.policies.internetExit === 'central') {
      demandMbps = Number((demandMbps * 1.25).toFixed(1));
    }

    const fiberPenalty =
      faults.coreFiberCut && !site.isPrimaryHub ? (design.policies.frrEnabled ? 1.14 : 1.65) : 1.0;
    const routerFailoverPenalty =
      faults.primaryRouterDown && site.isPrimaryHub ? (design.policies.hsrpEnabled ? 1.05 : 2.2) : 1.0;

    const effectiveCap = isDown ? 0 : site.capacityMbps;
    const utilPct = isDown
      ? 100
      : Math.min(180, Number(((demandMbps / Math.max(1, effectiveCap)) * 100).toFixed(1)));

    const opticalBudget = calculateGponOpticalBudget(site);
    const opticalFaultPenalty =
      opticalBudget && opticalBudget.status !== 'ok' ? 0.35 : 0;

    const baseLat = getBaseLatencyMs(site.technology, site.distanceKm, design.policies.ipsecOnGpon);
    const congestionQueuingMs =
      utilPct > 85
        ? (utilPct - 85) * (design.policies.qosEnabled ? 0.55 : 1.85)
        : utilPct > 65
        ? (utilPct - 65) * 0.18
        : 0.4;

    const latencyMs = isDown
      ? 999
      : Number((baseLat * fiberPenalty * routerFailoverPenalty + congestionQueuingMs).toFixed(1));

    const jitterMs = isDown
      ? 99
      : Number(
          (
            (design.policies.qosEnabled ? 1.4 : 4.8) +
            (utilPct > 80 ? (utilPct - 80) * (design.policies.qosEnabled ? 0.25 : 0.9) : 0.6)
          ).toFixed(1)
        );

    const packetLossPct = isDown
      ? 100
      : Number(
          (
            (faults.coreFiberCut && !design.policies.frrEnabled && !site.isPrimaryHub
              ? 4.2
              : faults.primaryRouterDown && site.isPrimaryHub && !design.policies.hsrpEnabled
              ? 18.5
              : utilPct > 95
              ? (utilPct - 95) * (design.policies.qosEnabled ? 0.08 : 0.28)
              : utilPct > 82
              ? (utilPct - 82) * 0.012
              : 0.02) + opticalFaultPenalty
          ).toFixed(2)
        );

    const slaCompliant =
      !isDown &&
      utilPct < 98 &&
      latencyMs <= design.policies.slaLatencyVoiceMs &&
      packetLossPct <= design.policies.slaLossPct &&
      (!opticalBudget || opticalBudget.status === 'ok');

    let status: SiteHourlyMetrics['status'] = 'nominal';
    if (isDown || !slaCompliant || utilPct >= 95) {
      status = isDown ? 'down' : 'critical';
    } else if (utilPct >= 75 || latencyMs > design.policies.slaLatencyVoiceMs * 0.85) {
      status = 'warning';
    }

    return {
      siteId: site.id,
      siteName: site.name,
      city: site.city,
      technology: site.technology,
      capacityMbps: site.capacityMbps,
      demandMbps: isDown ? 0 : demandMbps,
      utilizationPct: utilPct,
      latencyMs,
      jitterMs,
      packetLossPct,
      status,
      slaCompliant,
      hourlySeries,
      opticalBudget,
    };
  });

  const totalSites = siteMetrics.length;
  const sitesInSla = siteMetrics.filter((s) => s.slaCompliant).length;
  const totalDemandMbps = Number(siteMetrics.reduce((acc, s) => acc + s.demandMbps, 0).toFixed(1));
  const totalCapacityMbps = siteMetrics.reduce((acc, s) => acc + s.capacityMbps, 0);
  const upSites = siteMetrics.filter((s) => s.status !== 'down');
  const avgLatencyMs =
    upSites.length > 0
      ? Number((upSites.reduce((acc, s) => acc + s.latencyMs, 0) / upSites.length).toFixed(1))
      : 999;

  const complianceRatio = totalSites > 0 ? sitesInSla / totalSites : 1;
  const avgUtil =
    upSites.length > 0
      ? upSites.reduce((acc, s) => acc + s.utilizationPct, 0) / upSites.length
      : 100;
  let globalSlaPct = 99.99;
  if (complianceRatio < 1) {
    globalSlaPct = Math.max(82.0, 99.65 * complianceRatio - (avgUtil > 85 ? 0.45 : 0));
  } else if (avgUtil > 70) {
    globalSlaPct = 99.99 - (avgUtil - 70) * 0.0085;
  } else {
    globalSlaPct = 99.99 - avgUtil * 0.002;
  }
  if (faults.centralInternetDown) globalSlaPct -= 0.42;
  if (faults.coreFiberCut && !design.policies.frrEnabled) globalSlaPct -= 1.15;
  if (faults.primaryRouterDown && !design.policies.hsrpEnabled) globalSlaPct -= 3.8;
  globalSlaPct = Number(Math.max(50, Math.min(99.998, globalSlaPct)).toFixed(3));

  let peakHour = 19;
  let maxPeakSum = -1;
  for (let h = 0; h < 24; h++) {
    const sum = siteMetrics.reduce((acc, s) => acc + (s.hourlySeries[h] || 0), 0);
    if (sum > maxPeakSum) {
      maxPeakSum = sum;
      peakHour = h;
    }
  }

  const validations: DesignValidationIssue[] = [];
  siteMetrics.forEach((m, idx) => {
    const site = design.sites[idx];
    const peakMbps = Math.max(...m.hourlySeries);
    const peakUtil = (peakMbps / Math.max(1, site.capacityMbps)) * 100;

    if (m.status === 'down') {
      validations.push({
        id: `down-${site.id}`,
        severity: 'error',
        siteName: site.name,
        category: 'Disponibilidad de enlace',
        message: `Enlace WAN cortado manualmente en ${site.city}. Tráfico aislado.`,
        recommendation: 'Activar respaldo celular/LTE o segundo proveedor BGP/MPLS.',
      });
    } else if (peakUtil > 85) {
      validations.push({
        id: `sat-${site.id}`,
        severity: peakUtil > 98 ? 'error' : 'warning',
        siteName: site.name,
        category: 'Saturación en hora pico',
        message: `Utilización pico proyectada de ${peakUtil.toFixed(1)}% (${peakMbps.toFixed(0)} / ${site.capacityMbps} Mbps).`,
        recommendation: `Ampliar capacidad contratada a ${Math.ceil((peakMbps * 1.35) / 50) * 50} Mbps o habilitar salida local a Internet.`,
      });
    }

    if (m.opticalBudget) {
      const ob = m.opticalBudget;
      if (ob.status === 'low_signal') {
        validations.push({
          id: `opt-low-${site.id}`,
          severity: 'error',
          siteName: site.name,
          category: 'Presupuesto Óptico GPON ODN',
          message: `Señal recibida en ONT de ${ob.ontRxDbm} dBm cae por debajo del límite de sensibilidad (-27.0 dBm). Atenuación total: ${ob.totalAttenuationDb} dB (${ob.splitterRatio}, ${ob.distanceKm} km, Clase ${ob.opticalClass}).`,
          recommendation: `Cambiar módulo SFP OLT a Clase C+ (+5 dBm), reducir splitter a 1:16 o acortar troncal de fibra.`,
        });
      } else if (ob.status === 'saturation') {
        validations.push({
          id: `opt-sat-${site.id}`,
          severity: 'error',
          siteName: site.name,
          category: 'Saturación Óptica GPON ODN',
          message: `Potencia recibida en ONT de ${ob.ontRxDbm} dBm supera el límite de saturación (-8.0 dBm). Riesgo de daño al fotodiodo.`,
          recommendation: `Insertar atenuador óptico fijo de 5 dB o incrementar relación de splitter a 1:16 / 1:32.`,
        });
      }
    }

    if (!m.slaCompliant && m.status !== 'down' && (!m.opticalBudget || m.opticalBudget.status === 'ok')) {
      validations.push({
        id: `sla-${site.id}`,
        severity: 'error',
        siteName: site.name,
        category: 'Incumplimiento SLA de voz/video',
        message: `Latencia ${m.latencyMs} ms / pérdida ${m.packetLossPct}% supera umbral (${design.policies.slaLatencyVoiceMs} ms / ${design.policies.slaLossPct}%).`,
        recommendation: design.policies.qosEnabled
          ? 'Reducir sobre-suscripción o activar MPLS TE-FRR y cola LLQ EF prioritaria.'
          : 'Habilitar QoS DiffServ (LLQ + CBWFQ) en las políticas del núcleo inmediatamente.',
      });
    }

    if (site.technology === 'gpon' && design.policies.ipsecOnGpon) {
      validations.push({
        id: `mtu-${site.id}`,
        severity: 'info',
        siteName: site.name,
        category: 'Presupuesto MTU / MSS',
        message: `PPPoE (1492 B) + GRE/IPsec reduce la carga útil efectiva. Riesgo de fragmentación sin ajuste MSS.`,
        recommendation: 'Aplicar "ip tcp adjust-mss 1360" en interfaz Tunnel0 de la sede.',
      });
    }
  });

  if (!design.policies.qosEnabled) {
    validations.unshift({
      id: 'pol-no-qos',
      severity: 'error',
      siteName: 'Política Global del Núcleo',
      category: 'Calidad de Servicio (QoS)',
      message: 'QoS DiffServ desactivado. Tráfico masivo HTTP/ERP compite en FIFO con voz y telemedicina.',
      recommendation: 'Activar QoS DiffServ (LLQ EF 30% + CBWFQ AF41/AF21 + WRED).',
    });
  }

  if (!design.policies.hsrpEnabled) {
    validations.unshift({
      id: 'pol-no-hsrp',
      severity: 'warning',
      siteName: 'Datacenter Principal',
      category: 'Redundancia de Primer Salto',
      message: 'HSRP desactivado en routers de borde. Punto único de falla en gateway.',
      recommendation: 'Habilitar HSRP v2 con Object Tracking y temporizadores agresivos (250ms / 750ms).',
    });
  }

  const n1Matrix = evaluateN1Contingency(design, siteMetrics);
  const opex = calculateOpex(design, globalSlaPct, sitesInSla, totalSites);

  return {
    siteMetrics,
    globalSlaPct,
    sitesInSla,
    totalSites,
    totalDemandMbps,
    totalCapacityMbps,
    peakHour,
    avgLatencyMs,
    validations,
    n1Matrix,
    opex,
  };
}
