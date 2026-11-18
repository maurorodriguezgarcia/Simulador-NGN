export type ThemeMode = 'light' | 'dark';
export type WanArchitecture = 'metroethernet' | 'mpls' | 'gpon';
export type InfraPresetId = 'universidad' | 'empresa' | 'operador';
export type MainTabId = 'simulacion' | 'diseno' | 'convergencia' | 'cli' | 'matriz';

export type ScenarioId =
  | 'dhcp'
  | 'hsrp'
  | 'ppp'
  | 'nat'
  | 'vpn'
  | 'mpls'
  | 'qos'
  | 'ngn';

export type ServiceTag = 'DHCP' | 'HSRP' | 'PPP' | 'NAT' | 'VPN' | 'MPLS' | 'QoS';

export type GponSplitterRatio = '1:8' | '1:16' | '1:32' | '1:64';
export type GponOpticalClass = 'B+' | 'C+';

export interface SiteNode {
  id: string;
  name: string;
  city: string;
  region: string;
  /** SVG map coordinates (viewBox 0 0 360 440 for Colombia map) */
  mapX: number;
  mapY: number;
  role: 'datacenter' | 'regional' | 'campus' | 'pop';
  technology: WanArchitecture;
  capacityMbps: number;
  users: number;
  devices: number;
  vlanBase: number;
  subnetOctet: number;
  splitterRatio?: GponSplitterRatio;
  gponOpticalClass?: GponOpticalClass;
  distanceKm: number;
  isPrimaryHub?: boolean;
}

export interface CorePolicies {
  qosEnabled: boolean;
  internetExit: 'central' | 'local';
  ipsecOnGpon: boolean;
  cgnatRatio: 16 | 32 | 64;
  hsrpEnabled: boolean;
  frrEnabled: boolean;
  slaLatencyVoiceMs: number;
  slaLossPct: number;
  ipv6AdoptionPct: number; // 0 to 70%
  ipv6IspPrefix: string; // e.g., "2800:480::/32"
}

export interface AppDemands {
  voiceKbpsPerUser: number;
  videoKbpsPerUser: number;
  erpKbpsPerUser: number;
  webKbpsPerUser: number;
}

export interface InfraDesign {
  presetId: InfraPresetId;
  orgName: string;
  summaryTag: string;
  baseNetworkPrefix: string; // e.g., "10.20"
  policies: CorePolicies;
  appDemands: AppDemands;
  sites: SiteNode[];
}

export interface FaultInjection {
  cutSiteId: string | null;
  centralInternetDown: boolean;
  primaryRouterDown: boolean;
  coreFiberCut: boolean;
}

export interface GponOpticalBudget {
  siteId: string;
  siteName: string;
  city: string;
  opticalClass: GponOpticalClass;
  splitterRatio: GponSplitterRatio;
  distanceKm: number;
  oltTxDbm: number;
  splitterLossDb: number;
  fiberLossDb: number;
  connectorLossDb: number;
  totalAttenuationDb: number;
  ontRxDbm: number;
  sensitivityFloorDbm: number;
  saturationCeilingDbm: number;
  marginDb: number;
  status: 'ok' | 'low_signal' | 'saturation';
}

export interface SiteHourlyMetrics {
  siteId: string;
  siteName: string;
  city: string;
  technology: WanArchitecture;
  capacityMbps: number;
  demandMbps: number;
  utilizationPct: number;
  latencyMs: number;
  jitterMs: number;
  packetLossPct: number;
  status: 'nominal' | 'warning' | 'critical' | 'down';
  slaCompliant: boolean;
  hourlySeries: number[]; // 24 values (Mbps)
  opticalBudget?: GponOpticalBudget;
}

export interface DesignValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  siteName: string;
  category: string;
  message: string;
  recommendation: string;
}

export interface N1ContingencyScenario {
  id: string;
  title: string;
  failedElement: string;
  backupPath: string;
  backupCapacityMbps: number;
  reroutedDemandMbps: number;
  backupUtilizationPct: number;
  diffServTeActive: boolean;
  criticalEfPreserved: boolean;
  corpAfPreserved: boolean;
  bestEffortDropPct: number;
  failoverMs: number;
  verdict: 'resilient' | 'degraded_be' | 'saturated';
}

export interface OpexEstimate {
  metroCostUsd: number;
  mplsCostUsd: number;
  gponCostUsd: number;
  radioBackupCostUsd: number;
  ipTransitCostUsd: number;
  publicIpAndCgnatCostUsd: number;
  totalMonthlyUsd: number;
  slaPenaltyAvoidedUsd: number;
  cgnatSavingsIpv6Usd: number;
}

export interface BaselineSnapshot {
  label: string;
  capturedAtHour: number;
  globalSlaPct: number;
  avgLatencyMs: number;
  totalDemandMbps: number;
  sitesInSla: number;
  totalSites: number;
  opexMonthlyUsd: number;
  cgnatPortsRequired: number;
}

export interface PacketLayer {
  id: string;
  name: string;
  osiLayer: string;
  bytes: number;
  color: string;
  textColor: string;
  summary: string;
  fields: { label: string; value: string; highlight?: boolean }[];
}

export interface SimulationMetrics {
  linkName: string;
  totalFrameBytes: number;
  overheadL2Bytes: number;
  efficiencyPct: number;
  mtuBytes: number;
  mtuExceeded: boolean;
  serializationUs: number;
}

export interface ContextualTableData {
  title: string;
  subtitle: string;
  columns: string[];
  rows: { cells: string[]; status?: 'ok' | 'warn' | 'err' | 'info' }[];
}

export interface SyslogEntry {
  timestamp: string;
  facility: string;
  severity: number;
  mnemonic: string;
  device: string;
  message: string;
}

export interface SimulationStep {
  index: number;
  title: string;
  explanation: string;
  fromNode: string;
  toNode: string;
  pathPoints: string[];
  packetLabel: string;
  transformationBadge?: string;
  packetColor: string;
  layers: PacketLayer[];
  metrics: SimulationMetrics;
  contextualState: ContextualTableData;
  syslog: SyslogEntry;
}

export interface ScenarioInteractiveState {
  dhcpTargetSite: 'A' | 'B' | 'C';
  dhcpRogueServer: boolean;
  hsrpFailureMode: 'normal' | 'wan_down' | 'router_off';
  pppMode: 'serial_chap' | 'ftth_pppoe';
  pppSecret: string;
  pppExpectedSecret: string;
  pppMssClamp1452: boolean;
  natMode: 'static' | 'pat_burst';
  natSessionCount: number;
  natPayloadBytes: 64 | 512 | 1400;
  vpnMode: 'gre_ipsec' | 'gre_plain';
  vpnMss1360: boolean;
  vpnTcpSegmentBytes: number;
  mplsFiberCut: boolean;
  qosMode: 'diffserv' | 'fifo';
  qosWanSpeedMbps: number;
  ngnCodec: 'G.711' | 'G.729';
}

export interface ScenarioDidactic {
  object: string;
  application: string;
  benefit: string;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  number: number;
  category: 'Servicios de borde' | 'Acceso WAN y NAT' | 'VPN, MPLS y QoS' | 'Convergencia NGN';
  shortTitle: string;
  fullTitle: string;
  serviceTag: ServiceTag;
  didactic: ScenarioDidactic;
}

export interface VlsmSubnetRow {
  siteId: string;
  siteName: string;
  technology: WanArchitecture;
  vlanId: number;
  vlanName: string;
  network: string;
  cidr: number;
  mask: string;
  gateway: string;
  dhcpRange: string;
  broadcast: string;
  usableHosts: number;
  assignedHosts: number;
  occupancyPct: number;
  ipv6Prefix: string;
  ipv6Type: string;
}
