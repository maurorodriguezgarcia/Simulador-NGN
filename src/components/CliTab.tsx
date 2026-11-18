import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Filter, Server, Terminal } from 'lucide-react';
import { InfraDesign, ServiceTag, SiteNode } from '../types/network';
import {
  buildFullExportBundle,
  CliDeviceConfig,
  generateReferenceConfigs,
} from '../engine/cliGenerator';

interface CliTabProps {
  design: InfraDesign;
  sedeA: SiteNode;
  sedeB: SiteNode;
  sedeC: SiteNode;
}

const SERVICE_FILTERS: ServiceTag[] = ['DHCP', 'HSRP', 'PPP', 'NAT', 'VPN', 'MPLS', 'QoS'];

function highlightIosSyntax(text: string): React.ReactNode {
  if (text.trim().startsWith('!')) {
    return <span className="text-slate-400 italic">{text}</span>;
  }

  // Highlight IPv4/IPv6 addresses, masks, and header lines
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  const isHeaderLine =
    /^(hostname|interface|router|policy-map|class-map|crypto|ip vrf|ip access-list|ipv6)\b/.test(
      text.trim()
    );

  while ((match = ipRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      const seg = text.slice(lastIdx, match.index);
      parts.push(
        <span
          key={`t-${lastIdx}`}
          className={isHeaderLine ? 'text-sky-300 font-semibold' : 'text-slate-200'}
        >
          {seg}
        </span>
      );
    }
    parts.push(
      <span key={`ip-${match.index}`} className="text-amber-300 font-semibold">
        {match[0]}
      </span>
    );
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    const tail = text.slice(lastIdx);
    parts.push(
      <span
        key={`t-${lastIdx}`}
        className={isHeaderLine ? 'text-sky-300 font-semibold' : 'text-slate-200'}
      >
        {tail}
      </span>
    );
  }

  return parts.length > 0 ? parts : <span className="text-slate-200">{text}</span>;
}

export const CliTab: React.FC<CliTabProps> = ({ design, sedeA, sedeB, sedeC }) => {
  const allConfigs = useMemo(
    () => generateReferenceConfigs(design, sedeA, sedeB, sedeC),
    [design, sedeA, sedeB, sedeC]
  );

  const referenceDevices = useMemo(
    () => allConfigs.filter((d) => d.group === 'reference'),
    [allConfigs]
  );
  const parametricDevices = useMemo(
    () => allConfigs.filter((d) => d.group === 'parametric'),
    [allConfigs]
  );

  const [selectedId, setSelectedId] = useState<string>(allConfigs[0]?.id || '');
  const [activeFilter, setActiveFilter] = useState<ServiceTag | 'ALL'>('ALL');
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);

  const activeDevice: CliDeviceConfig =
    allConfigs.find((d) => d.id === selectedId) || allConfigs[0];

  const handleCopy = () => {
    const raw = activeDevice.lines.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleExportBundle = () => {
    const content = buildFullExportBundle(design, sedeA, sedeB, sedeC);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `paquete-cli-vlsm-${design.presetId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#E8EDF4] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Sidebar: Reference vs Parametric Devices */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-800 rounded-lg p-3.5 shadow-xs">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-700 dark:text-sky-400" />
              <span>Equipos de referencia (Escenarios)</span>
            </h2>
            <div className="space-y-1">
              {referenceDevices.map((dev) => {
                const isSelected = activeDevice.id === dev.id;
                return (
                  <button
                    key={dev.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(dev.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-md border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-700 border-sky-700 text-white dark:bg-sky-700/40 dark:border-sky-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 dark:bg-slate-950/60 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-mono font-semibold truncate">{dev.hostname}</div>
                    <div
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-sky-100 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {dev.roleLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-800 rounded-lg p-3.5 shadow-xs">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Equipos generados (Diseño paramétrico)</span>
            </h2>
            <div className="space-y-1 max-h-80 overflow-y-auto console-scroll pr-1">
              {parametricDevices.map((dev) => {
                const isSelected = activeDevice.id === dev.id;
                return (
                  <button
                    key={dev.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(dev.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-md border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-700 border-emerald-700 text-white dark:bg-emerald-700/35 dark:border-emerald-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 dark:bg-slate-950/60 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-mono font-semibold truncate">{dev.hostname}</div>
                    <div
                      className={`text-[11px] truncate ${
                        isSelected
                          ? 'text-emerald-100 dark:text-slate-300'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {dev.roleLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Code Viewer */}
        <section className="lg:col-span-8 xl:col-span-9 bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60">
            <div>
              <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {activeDevice.hostname}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">{activeDevice.roleLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900 p-1 rounded-md border border-slate-300/80 dark:border-slate-800">
                <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-1 mr-1" />
                <button
                  type="button"
                  aria-pressed={activeFilter === 'ALL'}
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded cursor-pointer transition-colors ${
                    activeFilter === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-slate-700'
                      : 'text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Todo
                </button>
                {SERVICE_FILTERS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={activeFilter === tag}
                    onClick={() => setActiveFilter(tag)}
                    className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded cursor-pointer transition-colors ${
                      activeFilter === tag
                        ? 'bg-sky-700 text-white dark:bg-sky-600'
                        : 'text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar CLI'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportBundle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                {exported ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                <span>{exported ? 'Paquete descargado' : 'Exportar paquete completo (.txt)'}</span>
              </button>
            </div>
          </div>

          {/* Syntax Highlighted Code Body (always dark IOS terminal for readability) */}
          <div className="p-4 bg-[#070B14] font-mono text-xs leading-relaxed overflow-x-auto max-h-[640px] overflow-y-auto console-scroll">
            {activeDevice.lines.map((line, idx) => {
              const isMatch = activeFilter === 'ALL' || line.tags.includes(activeFilter);
              const isHighlighted = activeFilter !== 'ALL' && line.tags.includes(activeFilter);

              return (
                <div
                  key={idx}
                  className={`flex items-baseline gap-4 px-2 py-0.5 rounded transition-opacity ${
                    isHighlighted
                      ? 'bg-sky-900/35 ring-1 ring-sky-500/40 opacity-100'
                      : isMatch
                      ? 'opacity-100'
                      : 'opacity-25'
                  }`}
                >
                  <span className="w-7 text-right text-slate-500 select-none tabular-nums shrink-0">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre">{highlightIosSyntax(line.text)}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

