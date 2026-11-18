import { useEffect, useMemo, useState } from 'react';
import { Bot } from 'lucide-react';
import { INFRA_PRESETS } from './data/presets';
import { evaluateDesignAtHour } from './engine/parametricCalc';
import { calculateCgnatOffload } from './engine/vlsm';
import {
  BaselineSnapshot,
  FaultInjection,
  InfraDesign,
  InfraPresetId,
  MainTabId,
  ScenarioId,
  ScenarioInteractiveState,
  SiteNode,
  ThemeMode,
  WanArchitecture,
} from './types/network';
import { HeaderBar } from './components/HeaderBar';
import { SimulationTab } from './components/SimulationTab';
import { ParametricDesignTab } from './components/ParametricDesignTab';
import { ConvergenceTab } from './components/ConvergenceTab';
import { CliTab } from './components/CliTab';
import { MatrixTab } from './components/MatrixTab';
import { CopilotDrawer } from './components/CopilotDrawer';

function clonePreset(id: InfraPresetId): InfraDesign {
  return JSON.parse(JSON.stringify(INFRA_PRESETS[id])) as InfraDesign;
}

function pickDefaultSedes(sites: SiteNode[]): { a: string; b: string; c: string } {
  const remotes = sites.filter((s) => !s.isPrimaryHub);
  const sedeA =
    remotes.find((s) => s.technology === 'metroethernet') ||
    remotes.find((s) => s.technology === 'mpls') ||
    remotes[0] ||
    sites[0];
  const sedeB =
    remotes.find((s) => s.id !== sedeA?.id && s.technology === 'mpls') ||
    remotes.find((s) => s.id !== sedeA?.id) ||
    sites[1] ||
    sites[0];
  const sedeC =
    remotes.find((s) => s.id !== sedeA?.id && s.id !== sedeB?.id && s.technology === 'gpon') ||
    remotes.find((s) => s.id !== sedeA?.id && s.id !== sedeB?.id) ||
    sites[2] ||
    sites[0];

  return {
    a: sedeA?.id || '',
    b: sedeB?.id || '',
    c: sedeC?.id || '',
  };
}

const DEFAULT_SCENARIO_STATE: ScenarioInteractiveState = {
  dhcpTargetSite: 'A',
  dhcpRogueServer: false,
  hsrpFailureMode: 'normal',
  pppMode: 'serial_chap',
  pppSecret: 'ngn2026',
  pppExpectedSecret: 'ngn2026',
  pppMssClamp1452: true,
  natMode: 'pat_burst',
  natSessionCount: 180,
  natPayloadBytes: 512,
  vpnMode: 'gre_ipsec',
  vpnMss1360: true,
  vpnTcpSegmentBytes: 1400,
  mplsFiberCut: false,
  qosMode: 'diffserv',
  qosWanSpeedMbps: 30,
  ngnCodec: 'G.711',
};

const THEME_STORAGE_KEY = 'ngn-sim-theme';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures in restricted contexts
    }
  }, [theme]);

  const [wanArch, setWanArch] = useState<WanArchitecture>('mpls');
  const [presetId, setPresetId] = useState<InfraPresetId>('universidad');
  const [design, setDesign] = useState<InfraDesign>(() => clonePreset('universidad'));
  const [activeTab, setActiveTab] = useState<MainTabId>('simulacion');
  const [activeHour, setActiveHour] = useState<number>(19);
  const [faults, setFaults] = useState<FaultInjection>({
    cutSiteId: null,
    centralInternetDown: false,
    primaryRouterDown: false,
    coreFiberCut: false,
  });
  const [baseline, setBaseline] = useState<BaselineSnapshot | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const initialSedes = useMemo(() => pickDefaultSedes(INFRA_PRESETS.universidad.sites), []);
  const [sedeAId, setSedeAId] = useState<string>(initialSedes.a);
  const [sedeBId, setSedeBId] = useState<string>(initialSedes.b);
  const [sedeCId, setSedeCId] = useState<string>(initialSedes.c);

  const [activeScenario, setActiveScenario] = useState<ScenarioId>('dhcp');
  const [scenarioState, setScenarioState] = useState<ScenarioInteractiveState>(
    DEFAULT_SCENARIO_STATE
  );

  const handleChangePreset = (newPreset: InfraPresetId) => {
    const nextDesign = clonePreset(newPreset);
    setPresetId(newPreset);
    setDesign(nextDesign);
    const nextSedes = pickDefaultSedes(nextDesign.sites);
    setSedeAId(nextSedes.a);
    setSedeBId(nextSedes.b);
    setSedeCId(nextSedes.c);
    setFaults({
      cutSiteId: null,
      centralInternetDown: false,
      primaryRouterDown: false,
      coreFiberCut: false,
    });
    setBaseline(null);
  };

  const handleResetAll = () => {
    const fresh = clonePreset(presetId);
    setDesign(fresh);
    const nextSedes = pickDefaultSedes(fresh.sites);
    setSedeAId(nextSedes.a);
    setSedeBId(nextSedes.b);
    setSedeCId(nextSedes.c);
    setActiveHour(19);
    setFaults({
      cutSiteId: null,
      centralInternetDown: false,
      primaryRouterDown: false,
      coreFiberCut: false,
    });
    setScenarioState(DEFAULT_SCENARIO_STATE);
    setBaseline(null);
  };

  const sedeA = useMemo(
    () => design.sites.find((s) => s.id === sedeAId) || design.sites[1] || design.sites[0],
    [design.sites, sedeAId]
  );
  const sedeB = useMemo(
    () => design.sites.find((s) => s.id === sedeBId) || design.sites[2] || design.sites[0],
    [design.sites, sedeBId]
  );
  const sedeC = useMemo(
    () => design.sites.find((s) => s.id === sedeCId) || design.sites[3] || design.sites[0],
    [design.sites, sedeCId]
  );

  const evaluation = useMemo(
    () => evaluateDesignAtHour(design, activeHour, faults),
    [design, activeHour, faults]
  );

  const cgnatSummary = useMemo(() => calculateCgnatOffload(design), [design]);

  const handleSaveBaseline = () => {
    const timeLabel = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setBaseline({
      label: `Línea base ${design.orgName} · ${String(activeHour).padStart(2, '0')}:00 (${timeLabel})`,
      capturedAtHour: activeHour,
      globalSlaPct: evaluation.globalSlaPct,
      avgLatencyMs: evaluation.avgLatencyMs,
      totalDemandMbps: evaluation.totalDemandMbps,
      sitesInSla: evaluation.sitesInSla,
      totalSites: evaluation.totalSites,
      opexMonthlyUsd: evaluation.opex.totalMonthlyUsd,
      cgnatPortsRequired: cgnatSummary.publicIpsWithIpv6,
    });
  };

  const handleJumpToScenario = (id: ScenarioId) => {
    setActiveScenario(id);
    setActiveTab('simulacion');
  };

  return (
    <div className="min-h-screen bg-[#E8EDF4] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 flex flex-col">
      <HeaderBar
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
        wanArch={wanArch}
        onChangeWanArch={setWanArch}
        presetId={presetId}
        onChangePreset={handleChangePreset}
        liveSlaPct={evaluation.globalSlaPct}
        onResetAll={handleResetAll}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        design={design}
        sitesInSla={evaluation.sitesInSla}
        totalSites={evaluation.totalSites}
        activeHour={activeHour}
        sedeA={sedeA}
        sedeB={sedeB}
        sedeC={sedeC}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      <main className="flex-1 print-full-width">
        {activeTab === 'simulacion' && (
          <SimulationTab
            theme={theme}
            wanArch={wanArch}
            design={design}
            sedeAId={sedeA.id}
            sedeBId={sedeB.id}
            sedeCId={sedeC.id}
            onChangeSedeA={setSedeAId}
            onChangeSedeB={setSedeBId}
            onChangeSedeC={setSedeCId}
            sedeA={sedeA}
            sedeB={sedeB}
            sedeC={sedeC}
            siteMetrics={evaluation.siteMetrics}
            activeScenario={activeScenario}
            onSelectScenario={setActiveScenario}
            scenarioState={scenarioState}
            onUpdateScenarioState={(patch) =>
              setScenarioState((prev) => ({ ...prev, ...patch }))
            }
          />
        )}

        {activeTab === 'diseno' && (
          <ParametricDesignTab
            theme={theme}
            design={design}
            onChangePreset={handleChangePreset}
            onUpdateDesign={setDesign}
            activeHour={activeHour}
            onChangeHour={setActiveHour}
            faults={faults}
            onChangeFaults={setFaults}
            evaluation={evaluation}
            baseline={baseline}
            onSaveBaseline={handleSaveBaseline}
            onClearBaseline={() => setBaseline(null)}
          />
        )}

        {activeTab === 'convergencia' && (
          <ConvergenceTab
            design={design}
            evaluation={evaluation}
            sedeA={sedeA}
            sedeB={sedeB}
            sedeC={sedeC}
            onJumpToScenario={handleJumpToScenario}
          />
        )}

        {activeTab === 'cli' && (
          <CliTab design={design} sedeA={sedeA} sedeB={sedeB} sedeC={sedeC} />
        )}

        {activeTab === 'matriz' && (
          <MatrixTab
            design={design}
            activeWanArch={wanArch}
            onSelectWanArch={setWanArch}
            onJumpToScenario={handleJumpToScenario}
          />
        )}
      </main>

      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        design={design}
        activeHour={activeHour}
        faults={faults}
        evaluation={evaluation}
        sedeA={sedeA}
        sedeB={sedeB}
        sedeC={sedeC}
      />

      {!isCopilotOpen && (
        <button
          type="button"
          onClick={() => setIsCopilotOpen(true)}
          aria-label="Abrir Copiloto NOC ISP"
          className="no-print fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold shadow-lg border border-sky-500/40 cursor-pointer transition-colors"
        >
          <Bot className="w-4 h-4" />
          <span>Copiloto NOC ISP</span>
        </button>
      )}
    </div>
  );
}

