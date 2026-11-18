import {
  InfraDesign,
  ScenarioDefinition,
  ScenarioId,
  ScenarioInteractiveState,
  SimulationStep,
  SiteNode,
  WanArchitecture,
} from '../types/network';
import { computeMd5Hex } from './md5';

export const SCENARIO_DEFINITIONS: ScenarioDefinition[] = [
  {
    id: 'dhcp',
    number: 1,
    category: 'Servicios de borde',
    shortTitle: 'DHCP centralizado y relay',
    fullTitle: '1. DHCP centralizado, agente relay y DHCP Snooping',
    serviceTag: 'DHCP',
    didactic: {
      object:
        'Automatizar la asignación IP (IP, máscara, gateway HSRP y DNS) desde un servidor central en el Datacenter superando el dominio de broadcast L2 mediante ip helper-address, y proteger la red contra servidores falsos con DHCP Snooping.',
      application:
        'En sedes remotas sin servidor local, el router de acceso intercepta el DHCP Discover broadcast (UDP 68→67), inserta su IP de interfaz en el campo giaddr y lo reenvía en unicast al SRV-DHCP central. Los puertos de acceso se configuran como untrusted.',
      benefit:
        'Administración centralizada de pools VLSM, trazabilidad de arrendamientos, prevención de agotamiento IP y mitigación inmediata de ataques Rogue DHCP / Man-in-the-Middle en LAN.',
    },
  },
  {
    id: 'hsrp',
    number: 2,
    category: 'Servicios de borde',
    shortTitle: 'HSRP con object tracking',
    fullTitle: '2. HSRP v2 con Object Tracking y temporizadores sub-segundo',
    serviceTag: 'HSRP',
    didactic: {
      object:
        'Proveer redundancia de gateway de primer salto (FHRP) mediante una IP virtual y MAC virtual compartida (0000.0c9f.f001) entre R-BORDE-A y R-BORDE-B, sincronizada con detección rápida de fallas.',
      application:
        'R-BORDE-A opera como Active (prioridad 110) monitoreando su enlace WAN mediante IP SLA / Track 1. Si el enlace WAN cae, decrementa su prioridad en 20 (90 < 100) y R-BORDE-B asume automáticamente; si R-BORDE-A se apaga, expira el Hold Timer de 750 ms.',
      benefit:
        'Conmutación transparente sin cambiar el gateway en los hosts ni perder sesiones TCP activas, reduciendo el tiempo de indisponibilidad de 10 segundos a menos de 750 ms.',
    },
  },
  {
    id: 'ppp',
    number: 3,
    category: 'Acceso WAN y NAT',
    shortTitle: 'PPP CHAP MD5 y PPPoE',
    fullTitle: '3. Autenticación PPP CHAP (MD5) y acceso FTTH PPPoE',
    serviceTag: 'PPP',
    didactic: {
      object:
        'Establecer enlaces punto a punto autenticados sin transmitir contraseñas en texto plano mediante el desafío criptográfico CHAP (RFC 1994) y encapsular tráfico Ethernet sobre acceso FTTH mediante PPPoE (RFC 2516).',
      application:
        'En enlaces seriales/síncronos, el autenticador envía un Challenge aleatorio; el cliente calcula MD5(ID + secreto + challenge). En FTTH GPON, el router Dialer añade 8 bytes de cabecera PPPoE (6B PPPoE + 2B PPP), reduciendo la MTU a 1492 B y exigiendo ajuste TCP MSS a 1452 B.',
      benefit:
        'Autenticación inmune a sniffing en el enlace WAN, control por sesión (AAA/RADIUS) y prevención de agujeros negros de Path MTU Discovery en navegación HTTPS sobre FTTH.',
    },
  },
  {
    id: 'nat',
    number: 4,
    category: 'Acceso WAN y NAT',
    shortTitle: 'NAT estático y PAT overload',
    fullTitle: '4. NAT estático DMZ y PAT Overload (NAPT / CGNAT)',
    serviceTag: 'NAT',
    didactic: {
      object:
        'Traducir direcciones IPv4 privadas RFC 1918 hacia direcciones públicas enrutables, diferenciando mapeo 1:1 para servidores DMZ y multiplexación por puertos TCP/UDP (PAT/CGNAT) para cientos de sesiones simultáneas.',
      application:
        'El servidor SRV-WEB DMZ utiliza NAT estático 1:1 para ser alcanzable desde Internet. Las estaciones de las sedes comparten una única IP pública mediante PAT overload asignando puertos origen únicos (1024–65535) en la tabla de traducciones.',
      benefit:
        'Conservación masiva del espacio IPv4 público (relaciones hasta 64:1 en CGNAT), ocultamiento de topología interna y publicación controlada de servicios institucionales.',
    },
  },
  {
    id: 'vpn',
    number: 5,
    category: 'VPN, MPLS y QoS',
    shortTitle: 'VPN GRE sobre IPsec',
    fullTitle: '5. Túnel VPN GRE sobre IPsec (ESP AES-256 + ajuste MSS)',
    serviceTag: 'VPN',
    didactic: {
      object:
        'Transportar tráfico corporativo IP y multicast/dinámico sobre redes públicas no confiables combinando encapsulación GRE (RFC 2784) con confidencialidad, integridad y autenticación mediante IPsec ESP.',
      application:
        'El paquete original se encapsula en GRE (4B) + IP de entrega (20B), y todo el conjunto se cifra dentro de IPsec ESP (AES-256-GCM + tráiler + autenticación + IP externa). Esto consume ~76–88 bytes de overhead, haciendo crítico el ajuste MSS a 1360 bytes.',
      benefit:
        'Inmunidad total frente a captura e inspección MitM en tránsito por Internet, soporte de enrutamiento dinámico OSPF sobre el túnel y ausencia de fragmentación IP.',
    },
  },
  {
    id: 'mpls',
    number: 6,
    category: 'VPN, MPLS y QoS',
    shortTitle: 'MPLS L3VPN, LDP y FRR',
    fullTitle: '6. MPLS L3VPN con etiquetas LDP, MP-BGP VPNv4 y TE-FRR <50 ms',
    serviceTag: 'MPLS',
    didactic: {
      object:
        'Conmutar paquetes en el núcleo del operador usando etiquetas cortas de 32 bits (Shim Header), aislar clientes en tablas VRF independientes mediante MP-BGP VPNv4 y garantizar recuperación ante corte de fibra en menos de 50 ms.',
      application:
        'El PE de ingreso impone dos etiquetas (Push): etiqueta VPN (MP-BGP) y etiqueta de transporte LDP. Los routers P solo hacen Swap sobre la etiqueta externa; el penúltimo salto ejecuta PHP (Pop) y ante un corte de fibra activa un túnel de respaldo MPLS TE-FRR.',
      benefit:
        'Aislamiento L3 multiproveedor sin túneles punto a punto complejos, reenvío ultrarrápido en el core y continuidad operativa de voz y datos críticos frente a cortes físicos.',
    },
  },
  {
    id: 'qos',
    number: 7,
    category: 'VPN, MPLS y QoS',
    shortTitle: 'QoS DiffServ: LLQ y WRED',
    fullTitle: '7. QoS DiffServ: LLQ (EF), CBWFQ (AF41/AF21) y WRED frente a FIFO',
    serviceTag: 'QoS',
    didactic: {
      object:
        'Priorizar tráfico sensible a latencia y jitter (VoIP/Telemedicina DSCP EF) sobre flujos elásticos masivos (ERP/HTTP) cuando el enlace WAN sufre congestión, evitando inanición y sincronización global TCP.',
      application:
        'En el router de borde se marca el byte DSCP y se aplica Low Latency Queueing (LLQ) con prioridad estricta del 30%, Class-Based WFQ para video (AF41) y datos críticos (AF21), más descarte temprano aleatorio ponderado (WRED) antes de llenar las colas.',
      benefit:
        'Latencia de voz estable < 20 ms y jitter < 3 ms incluso con el enlace WAN al 100% de carga, frente a colas FIFO donde las descargas saturan el buffer (bufferbloat) y cortan las llamadas.',
    },
  },
  {
    id: 'ngn',
    number: 8,
    category: 'Convergencia NGN',
    shortTitle: 'Viaje NGN extremo a extremo',
    fullTitle: '8. Viaje NGN extremo a extremo: Telemedicina desde Sede C al Datacenter',
    serviceTag: 'QoS',
    didactic: {
      object:
        'Integrar en un único flujo real todos los planos NGN: acceso óptico GPON/PPPoE, DHCP relay sobre túnel GRE/IPsec, marcado QoS EF, transporte MPLS L3VPN, redundancia HSRP y entrega en el Datacenter.',
      application:
        'Una estación de telemedicina en Sede C obtiene IP vía DHCP Relay cifrado, envía flujo RTP de voz/video marcado DSCP EF (46) a través de ONT → OLT GPON (T-CONT EF) → IPsec ESP → núcleo MPLS → HSRP Active R-BORDE-A → SRV-WEB/TELEMED en Datacenter.',
      benefit:
        'Demuestra cómo las arquitecturas convergentes NGN garantizan seguridad, direccionamiento dinámico, alta disponibilidad y SLA estricto extremo a extremo sobre infraestructura multiservicio.',
    },
  },
];

function serializeUs(bytes: number, bandwidthMbps: number): number {
  const bits = bytes * 8;
  return Number((bits / bandwidthMbps).toFixed(1));
}

function buildMetrics(
  linkName: string,
  layers: { bytes: number; isL2?: boolean }[],
  mtuBytes: number,
  bandwidthMbps: number
) {
  const totalFrameBytes = layers.reduce((s, l) => s + l.bytes, 0);
  const overheadL2Bytes = layers.filter((l) => l.isL2).reduce((s, l) => s + l.bytes, 0);
  const dataLayer = layers[layers.length - 2] || { bytes: 0 };
  const efficiencyPct = Number(((dataLayer.bytes / Math.max(1, totalFrameBytes)) * 100).toFixed(1));
  const payloadPlusIp = totalFrameBytes - overheadL2Bytes;
  const mtuExceeded = payloadPlusIp > mtuBytes;
  return {
    linkName,
    totalFrameBytes,
    overheadL2Bytes,
    efficiencyPct,
    mtuBytes,
    mtuExceeded,
    serializationUs: serializeUs(totalFrameBytes, bandwidthMbps),
  };
}

export function buildScenarioSteps(
  scenarioId: ScenarioId,
  wanArch: WanArchitecture,
  design: InfraDesign,
  sedeA: SiteNode,
  sedeB: SiteNode,
  sedeC: SiteNode,
  state: ScenarioInteractiveState
): SimulationStep[] {
  const prefix = design.baseNetworkPrefix;
  const srvDhcpIp = `${prefix}.10.10`;
  const srvWebIp = `${prefix}.10.80`;
  const hsrpVip = `${prefix}.10.1`;

  const siteMap = { A: sedeA, B: sedeB, C: sedeC };

  // =========================================================================
  // 1. DHCP CENTRALIZADO Y RELAY + SNOOPING
  // =========================================================================
  if (scenarioId === 'dhcp') {
    const target = siteMap[state.dhcpTargetSite];
    const targetNodeId = `HOST_${state.dhcpTargetSite}`;
    const routerNodeId = `R_SEDE_${state.dhcpTargetSite}`;
    const swNodeId = `SW_SEDE_${state.dhcpTargetSite}`;
    const clientIp = `${prefix}.${target.subnetOctet * 2}.45`;
    const gatewayIp = `${prefix}.${target.subnetOctet * 2}.1`;
    const bw = target.capacityMbps;

    const steps: SimulationStep[] = [
      {
        index: 0,
        title: `DHCP Discover broadcast en ${target.city}`,
        explanation: `La estación de trabajo en ${target.name} arranca sin IP y emite un DHCP Discover L2 broadcast (FF:FF:FF:FF:FF:FF, IP 0.0.0.0 → 255.255.255.255) en VLAN ${target.vlanBase}.`,
        fromNode: targetNodeId,
        toNode: swNodeId,
        pathPoints: [targetNodeId, swNodeId, routerNodeId],
        packetLabel: 'DHCP Discover (Broadcast)',
        packetColor: '#0284C7',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet 802.1Q',
            osiLayer: 'L2 Enlace',
            bytes: 18,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: `VLAN ${target.vlanBase} · Broadcast FF:FF`,
            fields: [
              { label: 'MAC Origen', value: `00:1B:44:11:3A:0${state.dhcpTargetSite === 'A' ? '1' : state.dhcpTargetSite === 'B' ? '2' : '3'}` },
              { label: 'MAC Destino', value: 'FF:FF:FF:FF:FF:FF (Broadcast)' },
              { label: 'Tag 802.1Q', value: `VID=${target.vlanBase}, CoS=0` },
            ],
          },
          {
            id: 'ip',
            name: 'IPv4',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: '0.0.0.0 → 255.255.255.255',
            fields: [
              { label: 'IP Origen', value: '0.0.0.0' },
              { label: 'IP Destino', value: '255.255.255.255' },
              { label: 'Protocolo', value: '17 (UDP) · TTL=64' },
            ],
          },
          {
            id: 'udp',
            name: 'UDP',
            osiLayer: 'L4 Transporte',
            bytes: 8,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: '68 → 67 (BOOTP)',
            fields: [
              { label: 'Puerto Origen', value: '68 (bootpc)' },
              { label: 'Puerto Destino', value: '67 (bootps)' },
            ],
          },
          {
            id: 'data',
            name: 'DHCP Discover',
            osiLayer: 'L7 Aplicación',
            bytes: 300,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: 'giaddr=0.0.0.0 · Option 53=Discover',
            fields: [
              { label: 'XID', value: '0x39A4F012' },
              { label: 'giaddr', value: '0.0.0.0 (Local)', highlight: true },
              { label: 'Option 53', value: 'DHCP Discover (1)' },
            ],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'Checksum', value: '0x8A31C09E (Válido)' }],
          },
        ],
        metrics: buildMetrics(
          `LAN ${target.city} 1 Gbps`,
          [{ bytes: 18, isL2: true }, { bytes: 20 }, { bytes: 8 }, { bytes: 300 }, { bytes: 4, isL2: true }],
          1500,
          1000
        ),
        contextualState: {
          title: 'Tabla DHCP Snooping & Relay',
          subtitle: `Switch ${swNodeId} · Estado de puertos`,
          columns: ['Puerto / Equipo', 'Rol Snooping', 'VLAN', 'Estado'],
          rows: [
            { cells: [`Gi0/1 (${targetNodeId})`, 'Untrusted', `${target.vlanBase}`, 'Discover permitido'], status: 'ok' },
            { cells: [`Gi0/24 (Uplink ${routerNodeId})`, 'Trusted', `${target.vlanBase}`, 'Reenvío a Relay'], status: 'ok' },
            ...(state.dhcpRogueServer
              ? [{ cells: ['Gi0/8 (Servidor Falso)', 'Untrusted', `${target.vlanBase}`, 'OfertaRogue pendiente'], status: 'warn' as const }]
              : []),
          ],
        },
        syslog: {
          timestamp: '19:02:11.104',
          facility: 'DHCPSNOOP',
          severity: 6,
          mnemonic: 'DISCOVER_RX',
          device: swNodeId,
          message: `DHCPDISCOVER recibido en Gi0/1 VLAN ${target.vlanBase} (untrusted), reenviado a uplink Trusted Gi0/24.`,
        },
      },
      {
        index: 1,
        title: `Agente Relay inserta giaddr y envía Unicast al Datacenter`,
        explanation: `${routerNodeId} ejecuta "ip helper-address ${srvDhcpIp}". Convierte el broadcast en unicast hacia ${srvDhcpIp} e inserta su IP LAN (${gatewayIp}) en el campo giaddr para identificar el pool.`,
        fromNode: routerNodeId,
        toNode: 'SRV_DHCP',
        pathPoints: [
          routerNodeId,
          ...(state.dhcpTargetSite === 'C' ? ['ONT_C', 'SPLITTER', 'OLT_01'] : []),
          'PE_01',
          'P_01',
          'R_BORDE_A',
          'SW_CORE',
          'SRV_DHCP',
        ],
        packetLabel: `Relay Unicast (giaddr=${gatewayIp})`,
        transformationBadge: 'Broadcast → Unicast Relay',
        packetColor: '#0369A1',
        layers: [
          {
            id: 'l2',
            name: wanArch === 'gpon' && state.dhcpTargetSite === 'C' ? 'GEM + 802.1Q' : wanArch === 'mpls' ? 'Eth + MPLS' : 'Ethernet 802.1Q',
            osiLayer: 'L2 Enlace',
            bytes: wanArch === 'mpls' ? 22 : 18,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: wanArch === 'mpls' ? 'Push MPLS Label 24018' : 'Troncal WAN Proveedor',
            fields: [
              { label: 'Encapsulación', value: wanArch.toUpperCase() },
              { label: 'Next Hop', value: 'PE-01 → R-BORDE-A' },
            ],
          },
          {
            id: 'ip',
            name: 'IPv4 Unicast',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: `${gatewayIp} → ${srvDhcpIp}`,
            fields: [
              { label: 'IP Origen', value: `${gatewayIp} (${routerNodeId})`, highlight: true },
              { label: 'IP Destino', value: `${srvDhcpIp} (SRV-DHCP)`, highlight: true },
            ],
          },
          {
            id: 'udp',
            name: 'UDP',
            osiLayer: 'L4 Transporte',
            bytes: 8,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: '67 → 67 (Relay)',
            fields: [
              { label: 'Puerto Origen', value: '67' },
              { label: 'Puerto Destino', value: '67' },
            ],
          },
          {
            id: 'data',
            name: 'DHCP Relay',
            osiLayer: 'L7 Aplicación',
            bytes: 300,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: `giaddr=${gatewayIp} · Hop=1`,
            fields: [
              { label: 'giaddr', value: gatewayIp, highlight: true },
              { label: 'hops', value: '1' },
              { label: 'Pool Solicitado', value: `VLAN_${target.vlanBase}_${target.city}` },
            ],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'Checksum', value: '0x4F22B108' }],
          },
        ],
        metrics: buildMetrics(
          `WAN ${target.city} (${bw} Mbps)`,
          [{ bytes: wanArch === 'mpls' ? 22 : 18, isL2: true }, { bytes: 20 }, { bytes: 8 }, { bytes: 300 }, { bytes: 4, isL2: true }],
          1500,
          bw
        ),
        contextualState: {
          title: 'Pools configurados en SRV-DHCP Central',
          subtitle: `Selección automática según giaddr=${gatewayIp}`,
          columns: ['Pool', 'Subred', 'Gateway', 'Disponibles'],
          rows: [
            { cells: [`POOL-${sedeA.city}`, `${prefix}.${sedeA.subnetOctet * 2}.0/22`, `${prefix}.${sedeA.subnetOctet * 2}.1`, '840 IPs'], status: state.dhcpTargetSite === 'A' ? 'ok' : 'info' },
            { cells: [`POOL-${sedeB.city}`, `${prefix}.${sedeB.subnetOctet * 2}.0/23`, `${prefix}.${sedeB.subnetOctet * 2}.1`, '390 IPs'], status: state.dhcpTargetSite === 'B' ? 'ok' : 'info' },
            { cells: [`POOL-${sedeC.city}`, `${prefix}.${sedeC.subnetOctet * 2}.0/23`, `${prefix}.${sedeC.subnetOctet * 2}.1`, '412 IPs'], status: state.dhcpTargetSite === 'C' ? 'ok' : 'info' },
          ],
        },
        syslog: {
          timestamp: '19:02:11.119',
          facility: 'IP_DHCP_RELAY',
          severity: 6,
          mnemonic: 'HELPER_FWD',
          device: routerNodeId,
          message: `Reenviando BOOTREQUEST giaddr=${gatewayIp} hacia ip helper-address ${srvDhcpIp}.`,
        },
      },
      {
        index: 2,
        title: state.dhcpRogueServer
          ? 'Bloqueo de servidor falso por DHCP Snooping y entrega legítima'
          : 'SRV-DHCP responde DHCP Offer y DHCP Ack al cliente',
        explanation: state.dhcpRogueServer
          ? `Un servidor DHCP no autorizado en Gi0/8 intenta responder un Offer falso (gateway atacante). ${swNodeId} descarta la trama inmediatamente (DHCP Snooping untrusted) y permite únicamente la respuesta del puerto Trusted hacia ${clientIp}.`
          : `SRV-DHCP consulta el pool de ${gatewayIp}, reserva la IP ${clientIp} y envía Offer/Ack unicast hacia ${routerNodeId}, que lo entrega al host. El switch registra el binding en la tabla de Snooping.`,
        fromNode: 'SRV_DHCP',
        toNode: targetNodeId,
        pathPoints: [
          'SRV_DHCP',
          'SW_CORE',
          'R_BORDE_A',
          'P_01',
          'PE_01',
          ...(state.dhcpTargetSite === 'C' ? ['OLT_01', 'SPLITTER', 'ONT_C'] : []),
          routerNodeId,
          swNodeId,
          targetNodeId,
        ],
        packetLabel: state.dhcpRogueServer ? 'Offer Legítimo (Rogue DROP)' : `DHCP Ack (${clientIp})`,
        transformationBadge: state.dhcpRogueServer ? 'Rogue DHCP Bloqueado' : `Lease ${clientIp}`,
        packetColor: state.dhcpRogueServer ? '#D97706' : '#059669',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet 802.1Q',
            osiLayer: 'L2 Enlace',
            bytes: 18,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: `VLAN ${target.vlanBase} · Trusted Port`,
            fields: [
              { label: 'Puerto Origen', value: 'Gi0/24 (TRUSTED)', highlight: true },
              { label: 'VLAN', value: `${target.vlanBase}` },
            ],
          },
          {
            id: 'ip',
            name: 'IPv4',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: `${gatewayIp} → ${clientIp}`,
            fields: [
              { label: 'IP Origen', value: gatewayIp },
              { label: 'IP Asignada', value: clientIp, highlight: true },
            ],
          },
          {
            id: 'udp',
            name: 'UDP',
            osiLayer: 'L4 Transporte',
            bytes: 8,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: '67 → 68',
            fields: [{ label: 'Puertos', value: '67 → 68' }],
          },
          {
            id: 'data',
            name: 'DHCP Ack',
            osiLayer: 'L7 Aplicación',
            bytes: 312,
            color: '#059669',
            textColor: '#FFFFFF',
            summary: `yiaddr=${clientIp} · Lease 8h`,
            fields: [
              { label: 'yiaddr (Cliente)', value: clientIp, highlight: true },
              { label: 'Option 3 (Router)', value: gatewayIp },
              { label: 'Option 6 (DNS)', value: `${prefix}.10.53` },
              { label: 'Option 51 (Lease)', value: '28800 seg (8h)' },
            ],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'Checksum', value: '0xC19A002B' }],
          },
        ],
        metrics: buildMetrics(
          `LAN ${target.city} (${bw} Mbps)`,
          [{ bytes: 18, isL2: true }, { bytes: 20 }, { bytes: 8 }, { bytes: 312 }, { bytes: 4, isL2: true }],
          1500,
          bw
        ),
        contextualState: {
          title: 'Base de Datos DHCP Snooping Binding',
          subtitle: `Registro activo en ${swNodeId}`,
          columns: ['MAC Cliente', 'IP Asignada', 'Lease / Puerto', 'Seguridad'],
          rows: [
            { cells: [`001B.4411.3A0${state.dhcpTargetSite === 'A' ? '1' : state.dhcpTargetSite === 'B' ? '2' : '3'}`, clientIp, `28800s · Gi0/1`, 'Binding Válido'], status: 'ok' },
            ...(state.dhcpRogueServer
              ? [{ cells: ['DE:AD:BE:EF:99:01', '192.168.66.1 (Falsa)', 'Gi0/8 (Untrusted)', 'DESCARTADO (Snooping)'], status: 'err' as const }]
              : []),
          ],
        },
        syslog: state.dhcpRogueServer
          ? {
              timestamp: '19:02:11.148',
              facility: 'DHCP_SNOOPING',
              severity: 4,
              mnemonic: 'DHCP_SNOOPING_UNTRUSTED_PORT',
              device: swNodeId,
              message: `ALERTA: DHCPOFFER falso descartado en puerto untrusted Gi0/8. Cliente ${clientIp} protegido vía Gi0/24.`,
            }
          : {
              timestamp: '19:02:11.148',
              facility: 'DHCPD',
              severity: 6,
              mnemonic: 'LEASE_ASSIGNED',
              device: 'SRV-DHCP',
              message: `DHCPACK enviado para ${clientIp} (VLAN ${target.vlanBase} ${target.city}). Binding actualizado.`,
            },
      },
    ];

    return steps;
  }

  // =========================================================================
  // 2. HSRP CON OBJECT TRACKING
  // =========================================================================
  if (scenarioId === 'hsrp') {
    const isWanDown = state.hsrpFailureMode === 'wan_down';
    const isRouterOff = state.hsrpFailureMode === 'router_off';
    const activeRouter = state.hsrpFailureMode === 'normal' ? 'R_BORDE_A' : 'R_BORDE_B';

    return [
      {
        index: 0,
        title: 'Estado inicial: R-BORDE-A es Active (VIP HSRP)',
        explanation: `R-BORDE-A (prioridad 110) mantiene el rol Active para el gateway virtual ${hsrpVip} (MAC 0000.0c9f.f001), enviando mensajes HSRP Hello cada 250 ms. R-BORDE-B (prioridad 100) escucha en estado Standby.`,
        fromNode: 'SW_CORE',
        toNode: 'R_BORDE_A',
        pathPoints: ['SRV_WEB', 'SW_CORE', 'R_BORDE_A', 'PE_01'],
        packetLabel: `HSRP Active (${hsrpVip})`,
        packetColor: '#0284C7',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet',
            osiLayer: 'L2 Enlace',
            bytes: 14,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: 'MAC Multicast HSRP v2',
            fields: [
              { label: 'MAC Origen', value: '00:00:0C:9F:F0:01 (Virtual HSRP)', highlight: true },
              { label: 'MAC Destino', value: '01:00:5E:00:00:66 (224.0.0.102)' },
            ],
          },
          {
            id: 'ip',
            name: 'IPv4',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: `${prefix}.10.2 → 224.0.0.102`,
            fields: [
              { label: 'IP Origen', value: `${prefix}.10.2 (R-BORDE-A)` },
              { label: 'IP Destino', value: '224.0.0.102 (HSRPv2)' },
              { label: 'TTL', value: '1' },
            ],
          },
          {
            id: 'udp',
            name: 'UDP',
            osiLayer: 'L4 Transporte',
            bytes: 8,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: '1985 → 1985',
            fields: [{ label: 'Puerto', value: '1985 (HSRP)' }],
          },
          {
            id: 'data',
            name: 'HSRPv2 Hello',
            osiLayer: 'L7 Control',
            bytes: 40,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: 'State=Active · Pri=110 · Hold=750ms',
            fields: [
              { label: 'Grupo / VIP', value: `Grupo 1 · ${hsrpVip}`, highlight: true },
              { label: 'Prioridad', value: '110 (Track 1 UP)' },
              { label: 'Timers', value: 'Hello 250 ms / Hold 750 ms' },
            ],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'Checksum', value: '0x21E4990F' }],
          },
        ],
        metrics: buildMetrics('Core Datacenter 10 Gbps', [{ bytes: 14, isL2: true }, { bytes: 20 }, { bytes: 8 }, { bytes: 40 }, { bytes: 4, isL2: true }], 1500, 10000),
        contextualState: {
          title: 'Línea de Tiempo HSRP (ms)',
          subtitle: 'Operación nominal con temporizadores sub-segundo',
          columns: ['Tiempo', 'Router', 'Prioridad', 'Estado HSRP'],
          rows: [
            { cells: ['t = 0 ms', 'R-BORDE-A', '110 (Track UP)', 'Active (VIP .1)'], status: 'ok' },
            { cells: ['t = 250 ms', 'R-BORDE-B', '100', 'Standby'], status: 'info' },
          ],
        },
        syslog: {
          timestamp: '19:05:00.250',
          facility: 'HSRP',
          severity: 6,
          mnemonic: 'STATECHANGE',
          device: 'R-BORDE-A',
          message: `Gi0/0.10 Grupo 1 estado Active. Virtual IP ${hsrpVip}, MAC 0000.0c9f.f001.`,
        },
      },
      {
        index: 1,
        title: isWanDown
          ? 'Falla de enlace WAN: Object Tracking decrementa prioridad (-20)'
          : isRouterOff
          ? 'Apagado total de R-BORDE-A: Hold Timer de 750 ms en conteo'
          : 'Monitoreo continuo de Track 1 y Hello cada 250 ms',
        explanation: isWanDown
          ? `El enlace WAN Gi0/1 de R-BORDE-A cae. Track 1 pasa a Down y decrementa automáticamente la prioridad de 110 a 90. Al ser inferior a R-BORDE-B (100), envía un mensaje Coup/Resign inmediato.`
          : isRouterOff
          ? `R-BORDE-A pierde alimentación eléctrica. Deja de emitir Hellos en t=0 ms. R-BORDE-B inicia la cuenta regresiva del Hold Timer: 250 ms... 500 ms... 750 ms expirado.`
          : `Track 1 valida que el enlace hacia PE-01 permanece UP. R-BORDE-A conserva prioridad 110 sin ceder el rol Active.`,
        fromNode: 'R_BORDE_A',
        toNode: 'R_BORDE_B',
        pathPoints: ['R_BORDE_A', 'SW_CORE', 'R_BORDE_B'],
        packetLabel: isWanDown ? 'Track Down → Pri 90' : isRouterOff ? 'Hold Timer 750 ms' : 'Hello 250 ms OK',
        transformationBadge: isWanDown ? 'Decremento 110 → 90' : isRouterOff ? 'Hold 750ms Expirado' : undefined,
        packetColor: isWanDown || isRouterOff ? '#DC2626' : '#0284C7',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet',
            osiLayer: 'L2 Enlace',
            bytes: 14,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: isRouterOff ? 'Sin trama (Silencio)' : 'Multicast HSRPv2',
            fields: [
              { label: 'MAC Origen', value: isRouterOff ? 'N/A (Equipo apagado)' : '00:1A:2B:3C:4D:01' },
              { label: 'MAC Destino', value: '01:00:5E:00:00:66' },
            ],
          },
          {
            id: 'ip',
            name: 'IPv4',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: isRouterOff ? 'Timeout en Standby' : `${prefix}.10.2 → 224.0.0.102`,
            fields: [
              { label: 'Evento', value: isWanDown ? 'Track 1 DOWN' : isRouterOff ? 'Hold Timer 750 ms' : 'Track 1 UP', highlight: true },
            ],
          },
          {
            id: 'udp',
            name: 'UDP',
            osiLayer: 'L4 Transporte',
            bytes: 8,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: '1985 → 1985',
            fields: [{ label: 'Puerto', value: '1985' }],
          },
          {
            id: 'data',
            name: isWanDown ? 'HSRP Resign' : 'HSRP Timer',
            osiLayer: 'L7 Control',
            bytes: 40,
            color: isWanDown || isRouterOff ? '#DC2626' : '#2563EB',
            textColor: '#FFFFFF',
            summary: isWanDown ? 'Pri=90 < 100 · Resign' : isRouterOff ? 'Hold=750ms · 0 Hellos' : 'Pri=110 · Active',
            fields: [
              { label: 'Nueva Prioridad', value: isWanDown ? '90 (110 - 20)' : isRouterOff ? '0 (Offline)' : '110', highlight: true },
              { label: 'Tiempo Conmutación', value: isWanDown ? '~18 ms (Inmediato)' : isRouterOff ? '750 ms (Hold Timer)' : '0 ms' },
            ],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'Checksum', value: '0x9981AC3D' }],
          },
        ],
        metrics: buildMetrics('Core Datacenter 10 Gbps', [{ bytes: 14, isL2: true }, { bytes: 20 }, { bytes: 8 }, { bytes: 40 }, { bytes: 4, isL2: true }], 1500, 10000),
        contextualState: {
          title: 'Línea de Tiempo de Conmutación HSRP',
          subtitle: isWanDown ? 'Modo: Caída WAN + Object Tracking' : isRouterOff ? 'Modo: Apagado total R-BORDE-A' : 'Modo: Operación Normal',
          columns: ['Instante', 'Evento', 'Prioridad A / B', 'Gateway Activo'],
          rows: isWanDown
            ? [
                { cells: ['t = 0 ms', 'Gi0/1 R-BORDE-A Down', '110 / 100', 'R-BORDE-A'], status: 'warn' },
                { cells: ['t = 12 ms', 'Track 1 decrementa -20', '90 / 100', 'Resign enviado'], status: 'warn' },
                { cells: ['t = 18 ms', 'R-BORDE-B envía Coup + GARP', '90 / 100', 'R-BORDE-B Active'], status: 'ok' },
              ]
            : isRouterOff
            ? [
                { cells: ['t = 0 ms', 'Pérdida energía R-BORDE-A', '0 / 100', 'Último Hello'], status: 'err' },
                { cells: ['t = 500 ms', '2 Hellos perdidos', '0 / 100', 'Standby esperando'], status: 'warn' },
                { cells: ['t = 750 ms', 'Hold Timer expirado', '0 / 100', 'R-BORDE-B Active + GARP'], status: 'ok' },
              ]
            : [
                { cells: ['t = 0 ms', 'Hello R-BORDE-A', '110 / 100', 'R-BORDE-A Active'], status: 'ok' },
                { cells: ['t = 250 ms', 'Hello R-BORDE-A', '110 / 100', 'R-BORDE-A Active'], status: 'ok' },
              ],
        },
        syslog: isWanDown
          ? {
              timestamp: '19:05:14.012',
              facility: 'TRACK',
              severity: 4,
              mnemonic: 'STATE',
              device: 'R-BORDE-A',
              message: `Track 1 interface Gi0/1 line-protocol Up->Down. HSRP Gi0/0.10 prioridad 110->90.`,
            }
          : isRouterOff
          ? {
              timestamp: '19:05:14.750',
              facility: 'HSRP',
              severity: 5,
              mnemonic: 'HOLD_EXPIRED',
              device: 'R-BORDE-B',
              message: `Hold timer 750ms expirado para R-BORDE-A. R-BORDE-B asume estado Standby->Active.`,
            }
          : {
              timestamp: '19:05:14.250',
              facility: 'HSRP',
              severity: 6,
              mnemonic: 'KEEPALIVE',
              device: 'R-BORDE-A',
              message: `Track 1 UP. R-BORDE-A mantiene rol Active con prioridad 110.`,
            },
      },
      {
        index: 2,
        title: `Tráfico redirigido por ${activeRouter} vía Gratuitous ARP`,
        explanation: `${activeRouter} emite un Gratuitous ARP anunciando la MAC virtual 0000.0c9f.f001 en su puerto del SW-CORE. El tráfico hacia la WAN continúa fluyendo sin cambiar la configuración de los servidores.`,
        fromNode: 'SRV_WEB',
        toNode: 'PE_01',
        pathPoints: ['SRV_WEB', 'SW_CORE', activeRouter, 'PE_01'],
        packetLabel: `Tráfico vía ${activeRouter}`,
        transformationBadge: `${activeRouter} = Active`,
        packetColor: '#059669',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet GARP',
            osiLayer: 'L2 Enlace',
            bytes: 14,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: `MAC Virtual 0000.0c9f.f001 → ${activeRouter}`,
            fields: [
              { label: 'MAC Virtual', value: '00:00:0C:9F:F0:01', highlight: true },
              { label: 'Puerto SW-CORE', value: activeRouter === 'R_BORDE_A' ? 'Gi1/0/1' : 'Gi1/0/2' },
            ],
          },
          {
            id: 'ip',
            name: 'IPv4',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: `${srvWebIp} → WAN Remota`,
            fields: [
              { label: 'Gateway en Hosts', value: `${hsrpVip} (Sin cambios)` },
              { label: 'Router Físico', value: activeRouter, highlight: true },
            ],
          },
          {
            id: 'tcp',
            name: 'TCP',
            osiLayer: 'L4 Transporte',
            bytes: 20,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: '443 → 52144 (Sesión intacta)',
            fields: [{ label: 'Estado TCP', value: 'ESTABLISHED' }],
          },
          {
            id: 'data',
            name: 'Payload HTTPS',
            osiLayer: 'L7 Aplicación',
            bytes: 1200,
            color: '#059669',
            textColor: '#FFFFFF',
            summary: 'Aplicación continua',
            fields: [{ label: 'Pérdida de sesión', value: '0%' }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'Checksum', value: '0x7712DC01' }],
          },
        ],
        metrics: buildMetrics('Uplink Core 10 Gbps', [{ bytes: 14, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: 1200 }, { bytes: 4, isL2: true }], 1500, 10000),
        contextualState: {
          title: 'Estado Final HSRP',
          subtitle: `Gateway Virtual ${hsrpVip}`,
          columns: ['Equipo', 'Estado', 'Prioridad', 'MAC Virtual'],
          rows: [
            { cells: ['R-BORDE-A', state.hsrpFailureMode === 'normal' ? 'Active' : isRouterOff ? 'Offline' : 'Standby', isWanDown ? '90' : isRouterOff ? '0' : '110', state.hsrpFailureMode === 'normal' ? 'Activa en Gi1/0/1' : 'Liberada'], status: state.hsrpFailureMode === 'normal' ? 'ok' : 'warn' },
            { cells: ['R-BORDE-B', state.hsrpFailureMode === 'normal' ? 'Standby' : 'Active', '100', state.hsrpFailureMode === 'normal' ? 'En espera' : 'Activa en Gi1/0/2'], status: 'ok' },
          ],
        },
        syslog: {
          timestamp: '19:05:14.765',
          facility: 'HSRP',
          severity: 5,
          mnemonic: 'STATECHANGE',
          device: activeRouter,
          message: `Gi0/0.10 Grupo 1 Active. Gratuitous ARP enviado para ${hsrpVip} (0000.0c9f.f001).`,
        },
      },
    ];
  }

  // =========================================================================
  // 3. PPP CHAP MD5 Y PPPoE
  // =========================================================================
  if (scenarioId === 'ppp') {
    if (state.pppMode === 'serial_chap') {
      const challengeHex = '4A8F19C20E77B301';
      const chapId = '01';
      const clientDigest = computeMd5Hex(`${chapId}${state.pppSecret}${challengeHex}`);
      const expectedDigest = computeMd5Hex(`${chapId}${state.pppExpectedSecret}${challengeHex}`);
      const isMatch = clientDigest === expectedDigest;

      return [
        {
          index: 0,
          title: 'PPP CHAP Challenge enviado por el autenticador',
          explanation: `El router PE-01 envía un paquete CHAP Challenge (Code=1, ID=0x01) hacia R-SEDE-B (${sedeB.city}) con un valor aleatorio de 16 caracteres sin transmitir ninguna contraseña.`,
          fromNode: 'PE_01',
          toNode: 'R_SEDE_B',
          pathPoints: ['PE_01', 'R_SEDE_B'],
          packetLabel: `CHAP Challenge (${challengeHex})`,
          packetColor: '#0284C7',
          layers: [
            {
              id: 'ppp',
              name: 'PPP Header',
              osiLayer: 'L2 Enlace',
              bytes: 4,
              color: '#475569',
              textColor: '#FFFFFF',
              summary: 'Flag 7E · Proto 0xC223 (CHAP)',
              fields: [
                { label: 'Flag / Addr / Ctrl', value: '0x7E / 0xFF / 0x03' },
                { label: 'Protocolo PPP', value: '0xC223 (CHAP)', highlight: true },
              ],
            },
            {
              id: 'chap',
              name: 'CHAP Challenge',
              osiLayer: 'L2 Control Auth',
              bytes: 28,
              color: '#2563EB',
              textColor: '#FFFFFF',
              summary: `Code=1 · ID=0x01 · Challenge=${challengeHex}`,
              fields: [
                { label: 'Code', value: '1 (Challenge)' },
                { label: 'Identifier', value: '0x01' },
                { label: 'Challenge Value', value: challengeHex, highlight: true },
                { label: 'Name', value: 'PE-01-CORE' },
              ],
            },
            {
              id: 'fcs',
              name: 'PPP FCS',
              osiLayer: 'L2 Cola',
              bytes: 2,
              color: '#334155',
              textColor: '#FFFFFF',
              summary: 'CRC-16',
              fields: [{ label: 'FCS', value: '0x94A1' }],
            },
          ],
          metrics: buildMetrics(`Serial E1/WAN ${sedeB.city} (${sedeB.capacityMbps} Mbps)`, [{ bytes: 4, isL2: true }, { bytes: 28 }, { bytes: 2, isL2: true }], 1500, sedeB.capacityMbps),
          contextualState: {
            title: 'Cálculo Criptográfico CHAP MD5 (RFC 1994)',
            subtitle: 'Entrada del hash en R-SEDE-B',
            columns: ['Parámetro', 'Valor'],
            rows: [
              { cells: ['ID de sesión', `0x${chapId}`], status: 'info' },
              { cells: ['Challenge aleatorio', challengeHex], status: 'info' },
              { cells: ['Secreto en R-SEDE-B', state.pppSecret || '(vacío)'], status: 'info' },
              { cells: ['Secreto esperado PE-01', state.pppExpectedSecret], status: 'info' },
            ],
          },
          syslog: {
            timestamp: '19:08:01.044',
            facility: 'PPP',
            severity: 6,
            mnemonic: 'CHAP_CHALLENGE_TX',
            device: 'PE-01',
            message: `Serial0/0/0 enviando CHAP Challenge ID=1 valor=${challengeHex} hacia ${sedeB.city}.`,
          },
        },
        {
          index: 1,
          title: 'R-SEDE-B calcula MD5(ID + Secreto + Challenge) y responde',
          explanation: `R-SEDE-B calcula localmente el hash MD5 real concatenando ID (${chapId}), su secreto configurado ("${state.pppSecret}") y el Challenge. Envía únicamente el digest de 128 bits.`,
          fromNode: 'R_SEDE_B',
          toNode: 'PE_01',
          pathPoints: ['R_SEDE_B', 'PE_01'],
          packetLabel: `CHAP Response (${clientDigest.slice(0, 12)}…)`,
          transformationBadge: 'Hash MD5 calculado',
          packetColor: '#0D9488',
          layers: [
            {
              id: 'ppp',
              name: 'PPP Header',
              osiLayer: 'L2 Enlace',
              bytes: 4,
              color: '#475569',
              textColor: '#FFFFFF',
              summary: 'Proto 0xC223 (CHAP)',
              fields: [{ label: 'Protocolo', value: '0xC223 (CHAP)' }],
            },
            {
              id: 'chap',
              name: 'CHAP Response',
              osiLayer: 'L2 Control Auth',
              bytes: 34,
              color: '#0D9488',
              textColor: '#FFFFFF',
              summary: `MD5=${clientDigest.slice(0, 16)}...`,
              fields: [
                { label: 'Code', value: '2 (Response)' },
                { label: 'Identifier', value: '0x01' },
                { label: 'Hash MD5 Cliente', value: clientDigest, highlight: true },
                { label: 'Name', value: 'R-SEDE-B' },
              ],
            },
            {
              id: 'fcs',
              name: 'PPP FCS',
              osiLayer: 'L2 Cola',
              bytes: 2,
              color: '#334155',
              textColor: '#FFFFFF',
              summary: 'CRC-16',
              fields: [{ label: 'FCS', value: '0xB022' }],
            },
          ],
          metrics: buildMetrics(`Serial WAN ${sedeB.city}`, [{ bytes: 4, isL2: true }, { bytes: 34 }, { bytes: 2, isL2: true }], 1500, sedeB.capacityMbps),
          contextualState: {
            title: 'Verificación Hash MD5 Real',
            subtitle: 'Comparación bit a bit en PE-01',
            columns: ['Origen', 'Digest MD5 (128 bits)', 'Resultado'],
            rows: [
              { cells: ['R-SEDE-B (Recibido)', clientDigest, 'Enviado por WAN'], status: 'info' },
              { cells: ['PE-01 (Esperado)', expectedDigest, isMatch ? 'COINCIDE' : 'NO COINCIDE'], status: isMatch ? 'ok' : 'err' },
            ],
          },
          syslog: {
            timestamp: '19:08:01.059',
            facility: 'PPP',
            severity: 6,
            mnemonic: 'CHAP_RESPONSE_TX',
            device: 'R-SEDE-B',
            message: `CHAP Response enviado con digest MD5=${clientDigest}.`,
          },
        },
        {
          index: 2,
          title: isMatch ? 'CHAP Success (Code=3): Enlace PPP/IPCP UP' : 'CHAP Failure (Code=4): Contraseña incorrecta',
          explanation: isMatch
            ? 'Los dos resúmenes MD5 coinciden exactamente. PE-01 responde CHAP Success y negocia IPCP, habilitando el enlace WAN sin exponer la contraseña.'
            : 'Los resúmenes MD5 difieren porque la contraseña ingresada no coincide con el secreto del servidor ("ngn2026"). PE-01 rechaza la autenticación y derriba LCP.',
          fromNode: 'PE_01',
          toNode: 'R_SEDE_B',
          pathPoints: ['PE_01', 'R_SEDE_B'],
          packetLabel: isMatch ? 'CHAP Success (UP)' : 'CHAP Failure (DOWN)',
          transformationBadge: isMatch ? 'Auth OK · IPCP UP' : 'Auth Fallida',
          packetColor: isMatch ? '#059669' : '#DC2626',
          layers: [
            {
              id: 'ppp',
              name: 'PPP Header',
              osiLayer: 'L2 Enlace',
              bytes: 4,
              color: '#475569',
              textColor: '#FFFFFF',
              summary: 'Proto 0xC223 (CHAP)',
              fields: [{ label: 'Protocolo', value: '0xC223' }],
            },
            {
              id: 'chap',
              name: isMatch ? 'CHAP Success' : 'CHAP Failure',
              osiLayer: 'L2 Control Auth',
              bytes: 16,
              color: isMatch ? '#059669' : '#DC2626',
              textColor: '#FFFFFF',
              summary: isMatch ? 'Code=3 · Welcome' : 'Code=4 · Auth Failed',
              fields: [
                { label: 'Code', value: isMatch ? '3 (Success)' : '4 (Failure)', highlight: true },
                { label: 'Estado Enlace', value: isMatch ? 'IPCP OPENED' : 'LCP TERMINATED' },
              ],
            },
            {
              id: 'fcs',
              name: 'PPP FCS',
              osiLayer: 'L2 Cola',
              bytes: 2,
              color: '#334155',
              textColor: '#FFFFFF',
              summary: 'CRC-16',
              fields: [{ label: 'FCS', value: '0x110E' }],
            },
          ],
          metrics: buildMetrics(`Serial WAN ${sedeB.city}`, [{ bytes: 4, isL2: true }, { bytes: 16 }, { bytes: 2, isL2: true }], 1500, sedeB.capacityMbps),
          contextualState: {
            title: 'Resultado Autenticación CHAP MD5',
            subtitle: isMatch ? 'Sesión establecida' : 'Autenticación rechazada',
            columns: ['Campo', 'Estado'],
            rows: [
              { cells: ['Digest recibido', clientDigest], status: isMatch ? 'ok' : 'err' },
              { cells: ['Digest esperado', expectedDigest], status: 'info' },
              { cells: ['Veredicto', isMatch ? 'CHAP Success (Code 3)' : 'CHAP Failure (Code 4)'], status: isMatch ? 'ok' : 'err' },
            ],
          },
          syslog: isMatch
            ? {
                timestamp: '19:08:01.072',
                facility: 'PPP',
                severity: 5,
                mnemonic: 'CHAP_AUTH_OK',
                device: 'PE-01',
                message: `CHAP authentication passed para R-SEDE-B. Interfaz Serial0/0/0 up/up.`,
              }
            : {
                timestamp: '19:08:01.072',
                facility: 'PPP',
                severity: 3,
                mnemonic: 'CHAP_AUTH_FAIL',
                device: 'PE-01',
                message: `CHAP authentication failed para R-SEDE-B (MD5 mismatch). Enlace desconectado.`,
              },
        },
      ];
    }

    // FTTH PPPoE mode
    const tcpSegment = state.pppMssClamp1452 ? 1452 : 1460;
    const ipPacketSize = 20 + 20 + tcpSegment; // 1492 if clamped, 1500 if unclamped!
    const mtuExceeded = ipPacketSize > 1492;

    return [
      {
        index: 0,
        title: 'Descubrimiento PPPoE (PADI / PADO / PADR / PADS) sobre GPON',
        explanation: `La ONT y R-SEDE-C (${sedeC.city}) negocian una sesión PPPoE (Session ID 0x1A4F) con el BRAS/BNG pasando a través del Splitter 1:32 y la OLT-01. La sobrecarga PPPoE + PPP consume 8 bytes de la trama Ethernet de 1500 B.`,
        fromNode: 'R_SEDE_C',
        toNode: 'OLT_01',
        pathPoints: ['R_SEDE_C', 'ONT_C', 'SPLITTER', 'OLT_01', 'PE_01'],
        packetLabel: 'PPPoE Discovery (PADS 0x1A4F)',
        packetColor: '#0284C7',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet + GEM',
            osiLayer: 'L2 Acceso',
            bytes: 19,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: 'EtherType 0x8863 (Discovery)',
            fields: [
              { label: 'GEM Port', value: '101 (GPON Encap 5B)' },
              { label: 'EtherType', value: '0x8863 (PPPoE Discovery)' },
            ],
          },
          {
            id: 'pppoe',
            name: 'PPPoE PADS',
            osiLayer: 'L2 Sesión',
            bytes: 24,
            color: '#7C3AED',
            textColor: '#FFFFFF',
            summary: 'Session-ID=0x1A4F · MTU=1492',
            fields: [
              { label: 'Code', value: '0x65 (PADS)' },
              { label: 'Session ID', value: '0x1A4F', highlight: true },
              { label: 'MTU negociada', value: '1492 bytes' },
            ],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'Checksum', value: '0x02AE4411' }],
          },
        ],
        metrics: buildMetrics(`FTTH GPON ${sedeC.city} (${sedeC.capacityMbps} Mbps)`, [{ bytes: 19, isL2: true }, { bytes: 24 }, { bytes: 4, isL2: true }], 1492, sedeC.capacityMbps),
        contextualState: {
          title: 'Negociación PPPoE Active Discovery',
          subtitle: `ONT-C (${sedeC.city}) ↔ BNG/PE-01`,
          columns: ['Mensaje', 'Dirección', 'EtherType', 'Resultado'],
          rows: [
            { cells: ['PADI', 'R-SEDE-C → Broadcast', '0x8863', 'Busca concentrador'], status: 'info' },
            { cells: ['PADO / PADR', 'BNG ↔ R-SEDE-C', '0x8863', 'Oferta y petición'], status: 'info' },
            { cells: ['PADS', 'BNG → R-SEDE-C', '0x8863', 'Session ID 0x1A4F (MTU 1492)'], status: 'ok' },
          ],
        },
        syslog: {
          timestamp: '19:09:04.210',
          facility: 'PPPOE',
          severity: 6,
          mnemonic: 'SESSION_UP',
          device: 'R-SEDE-C',
          message: `PPPoE Session 0x1A4F establecida en Dialer1 vía OLT-01. MTU=1492 bytes.`,
        },
      },
      {
        index: 1,
        title: state.pppMssClamp1452
          ? 'Tráfico TCP con ajuste MSS 1452 B (encaja exacto en 1492 B)'
          : 'Sin ajuste MSS (1460 B): Paquete de 1500 B excede MTU PPPoE (1492 B)',
        explanation: state.pppMssClamp1452
          ? `Con "ip tcp adjust-mss 1452", el segmento TCP se limita a 1452 B. Sumando 20 B TCP + 20 B IP = 1492 B + 8 B PPPoE = 1500 B Ethernet. Cero fragmentación.`
          : `Sin ajuste MSS, el host envía segmentos de 1460 B (paquete IP de 1500 B). Al añadir 8 bytes PPPoE alcanzaría 1508 B en un enlace Ethernet de 1500 B, provocando fragmentación o descarte DF.`,
        fromNode: 'HOST_C',
        toNode: 'SRV_WEB',
        pathPoints: ['HOST_C', 'SW_SEDE_C', 'R_SEDE_C', 'ONT_C', 'SPLITTER', 'OLT_01', 'PE_01', 'P_01', 'R_BORDE_A', 'SW_CORE', 'SRV_WEB'],
        packetLabel: state.pppMssClamp1452 ? 'PPPoE 1500B OK (MSS 1452)' : 'EXCEDE MTU 1492B (1500B IP)',
        transformationBadge: state.pppMssClamp1452 ? 'MSS Clamped → 1452 B' : 'Fragmentación / Drop DF',
        packetColor: mtuExceeded ? '#DC2626' : '#059669',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet + GEM',
            osiLayer: 'L2 Enlace',
            bytes: 19,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: 'EtherType 0x8864 (PPPoE Session)',
            fields: [
              { label: 'GEM Header', value: '5 bytes' },
              { label: 'Ethernet', value: '14B · Type 0x8864' },
            ],
          },
          {
            id: 'pppoe',
            name: 'PPPoE + PPP',
            osiLayer: 'L2 Sesión',
            bytes: 8,
            color: '#7C3AED',
            textColor: '#FFFFFF',
            summary: '6B PPPoE + 2B PPP (0x0021 IPv4)',
            fields: [
              { label: 'PPPoE Header', value: '6 bytes (Session 0x1A4F)' },
              { label: 'PPP Protocol', value: '2 bytes (0x0021 IPv4)' },
            ],
          },
          {
            id: 'ip',
            name: 'IPv4',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: `DF=1 · Total IP=${ipPacketSize} B`,
            fields: [
              { label: 'Flags', value: 'DF=1 (Don’t Fragment)' },
              { label: 'Total Length', value: `${ipPacketSize} bytes`, highlight: mtuExceeded },
            ],
          },
          {
            id: 'tcp',
            name: 'TCP',
            osiLayer: 'L4 Transporte',
            bytes: 20,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: `MSS=${tcpSegment} B`,
            fields: [
              { label: 'MSS Negociado', value: `${tcpSegment} bytes`, highlight: true },
            ],
          },
          {
            id: 'data',
            name: 'Datos HTTPS',
            osiLayer: 'L7 Aplicación',
            bytes: tcpSegment,
            color: mtuExceeded ? '#DC2626' : '#059669',
            textColor: '#FFFFFF',
            summary: `${tcpSegment} B payload`,
            fields: [{ label: 'Carga útil', value: `${tcpSegment} bytes` }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'FCS', value: '0x881F2C9A' }],
          },
        ],
        metrics: buildMetrics(
          `Dialer1 PPPoE ${sedeC.city}`,
          [{ bytes: 19, isL2: true }, { bytes: 8, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: tcpSegment }, { bytes: 4, isL2: true }],
          1492,
          sedeC.capacityMbps
        ),
        contextualState: {
          title: 'Presupuesto MTU en PPPoE',
          subtitle: state.pppMssClamp1452 ? 'Ajuste TCP MSS 1452 activo' : 'Sin ajuste MSS (Riesgo PMTUD)',
          columns: ['Componente', 'Bytes', 'Estado'],
          rows: [
            { cells: ['MTU Física Ethernet', '1500 B', 'Límite de interfaz'], status: 'info' },
            { cells: ['Overhead PPPoE + PPP', '-8 B', '6B PPPoE + 2B PPP'], status: 'warn' },
            { cells: ['MTU Útil Dialer1', '1492 B', 'Límite IP máximo'], status: 'info' },
            { cells: ['Paquete IP resultante', `${ipPacketSize} B`, mtuExceeded ? 'EXCEDE 1492 B (ICMP Type 3 Code 4)' : 'ENCAJA EXACTO (0% fragmentación)'], status: mtuExceeded ? 'err' : 'ok' },
          ],
        },
        syslog: mtuExceeded
          ? {
              timestamp: '19:09:05.012',
              facility: 'IP',
              severity: 4,
              mnemonic: 'MTU_EXCEEDED',
              device: 'R-SEDE-C',
              message: `Paquete de ${ipPacketSize}B con bit DF=1 excede MTU 1492 de Dialer1. Enviando ICMP Fragmentation Needed.`,
            }
          : {
              timestamp: '19:09:05.012',
              facility: 'TCP',
              severity: 6,
              mnemonic: 'MSS_CLAMP_OK',
              device: 'R-SEDE-C',
              message: `TCP SYN MSS ajustado a 1452 bytes en Dialer1. Trama L2 total=1500B sin fragmentación.`,
            },
      },
    ];
  }

  // =========================================================================
  // 4. NAT ESTÁTICO Y PAT OVERLOAD
  // =========================================================================
  if (scenarioId === 'nat') {
    const insideIp = `${prefix}.${sedeA.subnetOctet * 2}.42`;
    const publicPatIp = '200.14.80.10';
    const staticPriv = srvWebIp;
    const staticPub = '200.14.80.12';
    const payload = state.natPayloadBytes;

    return [
      {
        index: 0,
        title:
          state.natMode === 'static'
            ? `NAT Estático 1:1: Solicitud externa hacia servidor DMZ (${staticPub})`
            : `Ráfaga PAT Overload: ${state.natSessionCount} sesiones simultáneas desde ${sedeA.city}`,
        explanation:
          state.natMode === 'static'
            ? `Un cliente en Internet consulta https://${staticPub}. R-BORDE-A traduce de forma simétrica 1:1 la IP pública ${staticPub} a la IP privada ${staticPriv} de SRV-WEB DMZ.`
            : `${state.natSessionCount} flujos simultáneos salen desde la red privada ${prefix}.${sedeA.subnetOctet * 2}.0/22 hacia Internet usando el mismo router de borde R-BORDE-A.`,
        fromNode: state.natMode === 'static' ? 'P_01' : 'HOST_A',
        toNode: 'R_BORDE_A',
        pathPoints:
          state.natMode === 'static'
            ? ['P_01', 'PE_01', 'R_BORDE_A']
            : ['HOST_A', 'SW_SEDE_A', 'R_SEDE_A', 'PE_01', 'P_01', 'R_BORDE_A'],
        packetLabel: state.natMode === 'static' ? `Ext → ${staticPub}` : `${state.natSessionCount} Sesiones Privadas`,
        packetColor: '#0284C7',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet',
            osiLayer: 'L2 Enlace',
            bytes: 18,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: '802.1Q',
            fields: [{ label: 'VLAN', value: `${sedeA.vlanBase}` }],
          },
          {
            id: 'ip',
            name: 'IPv4 Original',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: state.natMode === 'static' ? `198.18.5.9 → ${staticPub}` : `${insideIp} → 142.250.78.14`,
            fields: [
              { label: 'IP Origen', value: state.natMode === 'static' ? '198.18.5.9 (Internet)' : insideIp, highlight: true },
              { label: 'IP Destino', value: state.natMode === 'static' ? staticPub : '142.250.78.14' },
            ],
          },
          {
            id: 'tcp',
            name: 'TCP',
            osiLayer: 'L4 Transporte',
            bytes: 20,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: state.natMode === 'static' ? '51200 → 443' : '50001.. → 443',
            fields: [
              { label: 'Puerto Origen', value: state.natMode === 'static' ? '51200' : `50001..${50000 + state.natSessionCount}`, highlight: true },
              { label: 'Puerto Destino', value: '443 (HTTPS)' },
            ],
          },
          {
            id: 'data',
            name: 'Payload',
            osiLayer: 'L7 Aplicación',
            bytes: payload,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: `${payload} bytes`,
            fields: [{ label: 'Tamaño Payload', value: `${payload} B` }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'Checksum', value: '0x33A0119C' }],
          },
        ],
        metrics: buildMetrics(`Entrada R-BORDE-A`, [{ bytes: 18, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: payload }, { bytes: 4, isL2: true }], 1500, sedeA.capacityMbps),
        contextualState: {
          title: 'Tabla de Traducciones NAT / PAT',
          subtitle: state.natMode === 'static' ? 'Mapeo estático 1:1 DMZ' : `Multiplexación de ${state.natSessionCount} sesiones`,
          columns: ['Protocolo', 'Inside Local', 'Inside Global', 'Outside Global'],
          rows:
            state.natMode === 'static'
              ? [
                  { cells: ['TCP', `${staticPriv}:443`, `${staticPub}:443`, '198.18.5.9:51200'], status: 'ok' },
                  { cells: ['Static', staticPriv, staticPub, '--- (Permanente)'], status: 'info' },
                ]
              : Array.from({ length: Math.min(4, Math.max(2, Math.ceil(state.natSessionCount / 100))) }).map((_, i) => ({
                  cells: [
                    'TCP',
                    `${prefix}.${sedeA.subnetOctet * 2}.${42 + i}:${50001 + i}`,
                    `${publicPatIp}:${1024 + i * 7 + (state.natSessionCount % 50)}`,
                    '142.250.78.14:443',
                  ],
                  status: 'ok' as const,
                })),
        },
        syslog: {
          timestamp: '19:11:20.008',
          facility: 'NAT',
          severity: 6,
          mnemonic: 'XLATE_CREATE',
          device: 'R-BORDE-A',
          message:
            state.natMode === 'static'
              ? `Traducción estática 1:1 aplicada: ${staticPub} -> ${staticPriv}:443.`
              : `Ráfaga PAT: creadas ${state.natSessionCount} traducciones hacia Inside Global ${publicPatIp}.`,
        },
      },
      {
        index: 1,
        title:
          state.natMode === 'static'
            ? `Entrega traducida a SRV-WEB DMZ (${staticPriv})`
            : `Salida pública multiplexada en ${publicPatIp} (puertos únicos)`,
        explanation:
          state.natMode === 'static'
            ? `R-BORDE-A reescribe el IP destino de ${staticPub} a ${staticPriv} y recalcula el checksum IP/TCP antes de entregar al Datacenter.`
            : `Todas las ${state.natSessionCount} sesiones comparten la única IP pública ${publicPatIp}. Cada sesión queda distinguida por su puerto origen traducido (ocupación de tabla: ${((state.natSessionCount / 64511) * 100).toFixed(2)}%).`,
        fromNode: 'R_BORDE_A',
        toNode: state.natMode === 'static' ? 'SRV_WEB' : 'PE_01',
        pathPoints: state.natMode === 'static' ? ['R_BORDE_A', 'SW_CORE', 'SRV_WEB'] : ['R_BORDE_A', 'PE_01', 'P_01'],
        packetLabel: state.natMode === 'static' ? `NAT → ${staticPriv}` : `PAT ${publicPatIp} (${state.natSessionCount} ports)`,
        transformationBadge: state.natMode === 'static' ? `${staticPub} → ${staticPriv}` : `PAT Overload (${state.natSessionCount}x)`,
        packetColor: '#059669',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet',
            osiLayer: 'L2 Enlace',
            bytes: 14,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: 'L2 Recalculado',
            fields: [{ label: 'Interfaz Salida', value: state.natMode === 'static' ? 'Gi0/0.10' : 'Gi0/1 (Outside)' }],
          },
          {
            id: 'ip',
            name: 'IPv4 Traducida',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#059669',
            textColor: '#FFFFFF',
            summary: state.natMode === 'static' ? `198.18.5.9 → ${staticPriv}` : `${publicPatIp} → 142.250.78.14`,
            fields: [
              { label: 'IP Origen', value: state.natMode === 'static' ? '198.18.5.9' : `${publicPatIp} (Traducida)`, highlight: true },
              { label: 'IP Destino', value: state.natMode === 'static' ? `${staticPriv} (Traducida)` : '142.250.78.14', highlight: true },
            ],
          },
          {
            id: 'tcp',
            name: 'TCP (Puerto PAT)',
            osiLayer: 'L4 Transporte',
            bytes: 20,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: state.natMode === 'static' ? '51200 → 443' : `1024..${1024 + state.natSessionCount} → 443`,
            fields: [
              { label: 'Puerto Traducido', value: state.natMode === 'static' ? '443 (Sin cambio)' : `1024..${1024 + state.natSessionCount}`, highlight: true },
              { label: 'Checksum TCP', value: 'Recalculado' },
            ],
          },
          {
            id: 'data',
            name: 'Payload',
            osiLayer: 'L7 Aplicación',
            bytes: payload,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: `${payload} bytes`,
            fields: [{ label: 'Integridad', value: 'Intacta' }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'Checksum', value: '0x99FA0122' }],
          },
        ],
        metrics: buildMetrics(`Salida R-BORDE-A`, [{ bytes: 14, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: payload }, { bytes: 4, isL2: true }], 1500, 1000),
        contextualState: {
          title: 'Capacidad de Puertos PAT / CGNAT',
          subtitle: `Uso actual: ${state.natSessionCount} / 64,511 puertos disponibles por IP`,
          columns: ['Métrica', 'Valor', 'Estado'],
          rows: [
            { cells: ['Sesiones activas', `${state.natSessionCount}`, 'Normal'], status: 'ok' },
            { cells: ['IPs públicas consumidas', '1 IP (200.14.80.10)', `Ahorro ${state.natSessionCount}:1`], status: 'ok' },
            { cells: ['Política CGNAT diseño', `${design.policies.cgnatRatio}:1`, 'Activo en borde'], status: 'info' },
          ],
        },
        syslog: {
          timestamp: '19:11:20.025',
          facility: 'NAT',
          severity: 6,
          mnemonic: 'TRANSLATION_ACTIVE',
          device: 'R-BORDE-A',
          message:
            state.natMode === 'static'
              ? `Paquete entregado a ${staticPriv}:443 en DMZ.`
              : `PAT Overload activo: ${state.natSessionCount} puertos asignados en ${publicPatIp} (0 colisiones).`,
        },
      },
    ];
  }

  // =========================================================================
  // 5. VPN GRE SOBRE IPSEC
  // =========================================================================
  if (scenarioId === 'vpn') {
    const isIpsec = state.vpnMode === 'gre_ipsec';
    const segSize = state.vpnMss1360 ? Math.min(1360, state.vpnTcpSegmentBytes) : state.vpnTcpSegmentBytes;
    const innerIpBytes = 20 + 20 + segSize;
    const greAndDelivery = 4 + 20; // 24B
    const espOverhead = isIpsec ? 52 : 0; // ESP header(8) + IV(16) + Pad/Trailer(12) + ICV(16)
    const totalIpsecPacket = innerIpBytes + greAndDelivery + espOverhead;
    const mtuExceeded = totalIpsecPacket > 1492;

    return [
      {
        index: 0,
        title: `Segmento TCP original en ${sedeC.city}`,
        explanation: `La estación en ${sedeC.name} envía datos corporativos hacia el Datacenter con un segmento TCP de ${segSize} bytes${state.vpnMss1360 ? ' (limitado por ajuste MSS 1360)' : ''}.`,
        fromNode: 'HOST_C',
        toNode: 'R_SEDE_C',
        pathPoints: ['HOST_C', 'SW_SEDE_C', 'R_SEDE_C'],
        packetLabel: `IP Original (${innerIpBytes} B)`,
        packetColor: '#0284C7',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet 802.1Q',
            osiLayer: 'L2 Enlace',
            bytes: 18,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: `VLAN ${sedeC.vlanBase}`,
            fields: [{ label: 'VLAN', value: `${sedeC.vlanBase}` }],
          },
          {
            id: 'ip',
            name: 'IPv4 Privada',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: `${prefix}.${sedeC.subnetOctet * 2}.15 → ${srvWebIp}`,
            fields: [
              { label: 'IP Origen', value: `${prefix}.${sedeC.subnetOctet * 2}.15` },
              { label: 'IP Destino', value: srvWebIp },
            ],
          },
          {
            id: 'tcp',
            name: 'TCP',
            osiLayer: 'L4 Transporte',
            bytes: 20,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: `Segmento ${segSize} B`,
            fields: [{ label: 'MSS efectivo', value: `${segSize} bytes`, highlight: true }],
          },
          {
            id: 'data',
            name: 'Datos ERP/Historia',
            osiLayer: 'L7 Aplicación',
            bytes: segSize,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: 'Datos clínicos/ERP en texto claro LAN',
            fields: [{ label: 'Contenido', value: 'Registro clínico / Consulta SQL' }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'FCS', value: '0x4412FA09' }],
          },
        ],
        metrics: buildMetrics(`LAN ${sedeC.city}`, [{ bytes: 18, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: segSize }, { bytes: 4, isL2: true }], 1500, 1000),
        contextualState: {
          title: 'Presupuesto de Bytes Túnel VPN',
          subtitle: isIpsec ? 'GRE + IPsec ESP AES-256-GCM' : 'GRE Puro (Sin cifrado)',
          columns: ['Capa', 'Bytes', 'Estado'],
          rows: [
            { cells: ['Paquete IP interior', `${innerIpBytes} B`, 'IP(20)+TCP(20)+Datos'], status: 'info' },
            { cells: ['Cabecera GRE + IP Delivery', '+24 B', 'Proto 47'], status: 'info' },
            { cells: ['IPsec ESP (AES-256 + SHA256)', isIpsec ? '+52 B' : '0 B (Desactivado)', isIpsec ? 'Cifrado' : 'VULNERABLE MitM'], status: isIpsec ? 'ok' : 'err' },
          ],
        },
        syslog: {
          timestamp: '19:14:02.100',
          facility: 'TUNNEL',
          severity: 6,
          mnemonic: 'TX_PLAIN',
          device: 'R-SEDE-C',
          message: `Recibido paquete de ${innerIpBytes}B hacia ${srvWebIp}, enrutando por Tunnel0.`,
        },
      },
      {
        index: 1,
        title: isIpsec
          ? 'Encapsulación GRE + Cifrado IPsec ESP (Inmune a captura MitM)'
          : 'Encapsulación GRE Puro sin IPsec: ¡Tráfico expuesto a MitM en el Core!',
        explanation: isIpsec
          ? `R-SEDE-C encapsula en GRE y cifra todo con IPsec ESP (AES-256-GCM). Un atacante en tránsito solo ve IPs públicas y payload cifrado. Tamaño IP resultante: ${totalIpsecPacket} B${mtuExceeded ? ' (EXCEDE MTU 1492 -> Fragmentación!)' : ' (encaja sin fragmentar)'}.`
          : `R-SEDE-C envía GRE puro (Protocolo IP 47) sin IPsec. En el nodo del proveedor, un sniffer MitM lee íntegros la IP privada, puertos y datos de la aplicación.`,
        fromNode: 'R_SEDE_C',
        toNode: 'R_BORDE_A',
        pathPoints: ['R_SEDE_C', 'ONT_C', 'SPLITTER', 'OLT_01', 'PE_01', 'P_01', 'R_BORDE_A'],
        packetLabel: isIpsec ? `ESP Cifrado (${totalIpsecPacket} B)` : `GRE Sin Cifrar (${totalIpsecPacket} B) ⚠`,
        transformationBadge: isIpsec ? 'Cifrado ESP AES-256' : 'ALERTA MitM Texto Claro',
        packetColor: mtuExceeded ? '#DC2626' : isIpsec ? '#059669' : '#D97706',
        layers: [
          {
            id: 'l2',
            name: 'GEM + PPPoE',
            osiLayer: 'L2 Enlace',
            bytes: 27,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: 'GPON + PPPoE (MTU 1492)',
            fields: [{ label: 'Overhead L2', value: '27 bytes' }],
          },
          {
            id: 'ip_ext',
            name: 'IP Externa',
            osiLayer: 'L3 Delivery',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: isIpsec ? '190.85.44.22 → 200.14.80.10 (Proto 50)' : '190.85.44.22 → 200.14.80.10 (Proto 47)',
            fields: [
              { label: 'IP Pública Src', value: '190.85.44.22' },
              { label: 'IP Pública Dst', value: '200.14.80.10' },
              { label: 'Protocolo', value: isIpsec ? '50 (ESP)' : '47 (GRE Texto Claro)', highlight: true },
            ],
          },
          ...(isIpsec
            ? [
                {
                  id: 'esp',
                  name: 'IPsec ESP + GRE',
                  osiLayer: 'L3 Seguridad',
                  bytes: 56,
                  color: '#059669',
                  textColor: '#FFFFFF',
                  summary: 'SPI=0x8F11 · AES-256-GCM',
                  fields: [
                    { label: 'SPI', value: '0x8F11C204' },
                    { label: 'Cifrado', value: 'AES-256-CBC + HMAC-SHA256', highlight: true },
                    { label: 'GRE Interior', value: 'Cifrado (0x0800)' },
                  ],
                },
              ]
            : [
                {
                  id: 'gre',
                  name: 'GRE Puro',
                  osiLayer: 'L3 Túnel',
                  bytes: 4,
                  color: '#D97706',
                  textColor: '#FFFFFF',
                  summary: 'Sin cifrado (Proto 0x0800)',
                  fields: [
                    { label: 'GRE Protocol', value: '0x0800 (IPv4 expuesta)', highlight: true },
                  ],
                },
              ]),
          {
            id: 'payload',
            name: isIpsec ? 'Payload Cifrado' : 'Datos Expuestos',
            osiLayer: 'L4-L7 Túnel',
            bytes: innerIpBytes,
            color: isIpsec ? '#1E293B' : '#DC2626',
            textColor: '#FFFFFF',
            summary: isIpsec ? '7f9a3e8b12c4... (Ilegible)' : 'GET /paciente?id=1042 (Legible)',
            fields: [
              {
                label: 'Captura Sniffer MitM',
                value: isIpsec ? '0x7F9A3E8B12C490AA... (Protegido)' : `IP ${prefix}.${sedeC.subnetOctet * 2}.15 · GET /historia_clinica`,
                highlight: true,
              },
            ],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'FCS', value: '0xAA19820B' }],
          },
        ],
        metrics: buildMetrics(
          `Tunnel0 (${sedeC.city} → DC)`,
          [
            { bytes: 27, isL2: true },
            { bytes: 20 },
            { bytes: isIpsec ? 56 : 4 },
            { bytes: innerIpBytes },
            { bytes: 4, isL2: true },
          ],
          1492,
          sedeC.capacityMbps
        ),
        contextualState: {
          title: 'Auditoría Seguridad y MTU VPN',
          subtitle: mtuExceeded ? 'ALERTA: Excede MTU 1492 bytes' : 'MTU dentro de rango seguro',
          columns: ['Aspecto', 'Valor', 'Diagnóstico'],
          rows: [
            { cells: ['Segmento TCP', `${segSize} B`, state.vpnMss1360 ? 'MSS 1360 aplicado' : 'Sin límite MSS'], status: state.vpnMss1360 ? 'ok' : 'warn' },
            { cells: ['Tamaño Total IPsec/GRE', `${totalIpsecPacket} B`, mtuExceeded ? `Excede 1492 B (+${totalIpsecPacket - 1492} B)` : 'Sin fragmentación'], status: mtuExceeded ? 'err' : 'ok' },
            { cells: ['Protección MitM', isIpsec ? 'ESP AES-256 + SHA256' : 'Ninguna (GRE puro)', isIpsec ? 'Confidencialidad OK' : 'EXPUESTO A SNIFFING'], status: isIpsec ? 'ok' : 'err' },
          ],
        },
        syslog: isIpsec
          ? {
              timestamp: '19:14:02.130',
              facility: 'CRYPTO',
              severity: mtuExceeded ? 4 : 6,
              mnemonic: mtuExceeded ? 'IPSEC_FRAG_WARN' : 'IPSEC_ENCAP_OK',
              device: 'R-SEDE-C',
              message: mtuExceeded
                ? `ESP encapsulado (${totalIpsecPacket}B) excede MTU 1492 de Dialer1. Se requiere ip tcp adjust-mss 1360.`
                : `SA ESP 0x8F11C204 cifrado OK (${totalIpsecPacket}B <= MTU 1492). Cero fragmentación.`,
            }
          : {
              timestamp: '19:14:02.130',
              facility: 'SEC',
              severity: 3,
              mnemonic: 'UNENCRYPTED_GRE',
              device: 'P-01',
              message: `ADVERTENCIA: Tráfico GRE proto 47 sin ESP detectado desde 190.85.44.22. Carga útil visible en texto plano.`,
            },
      },
      {
        index: 2,
        title: 'Desencapsulación en R-BORDE-A y entrega en Datacenter',
        explanation: `R-BORDE-A valida la integridad HMAC-SHA256, descifra el paquete ESP, retira GRE y entrega el paquete IP privado original a SRV-WEB en el Datacenter.`,
        fromNode: 'R_BORDE_A',
        toNode: 'SRV_WEB',
        pathPoints: ['R_BORDE_A', 'SW_CORE', 'SRV_WEB'],
        packetLabel: 'Descifrado → SRV-WEB',
        transformationBadge: 'Trigger Desencapsulación',
        packetColor: '#059669',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet 802.1Q',
            osiLayer: 'L2 Enlace',
            bytes: 18,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: 'VLAN 10 Core',
            fields: [{ label: 'VLAN', value: '10' }],
          },
          {
            id: 'ip',
            name: 'IPv4 Privada',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: `${prefix}.${sedeC.subnetOctet * 2}.15 → ${srvWebIp}`,
            fields: [{ label: 'Destino', value: srvWebIp }],
          },
          {
            id: 'tcp',
            name: 'TCP',
            osiLayer: 'L4 Transporte',
            bytes: 20,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: 'Puerto 443',
            fields: [{ label: 'Estado', value: 'ESTABLISHED' }],
          },
          {
            id: 'data',
            name: 'Datos Entregados',
            osiLayer: 'L7 Aplicación',
            bytes: segSize,
            color: '#059669',
            textColor: '#FFFFFF',
            summary: `${segSize} B verificados`,
            fields: [{ label: 'Integridad', value: isIpsec ? 'HMAC-SHA256 Verificado' : 'Sin verificación criptográfica' }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'FCS', value: '0x5510BC1E' }],
          },
        ],
        metrics: buildMetrics(`Core Datacenter 10 Gbps`, [{ bytes: 18, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: segSize }, { bytes: 4, isL2: true }], 1500, 10000),
        contextualState: {
          title: 'Estado SA IPsec en R-BORDE-A',
          subtitle: 'Estadísticas del túnel Tunnel100',
          columns: ['Peer', 'Modo', 'Paquetes Descifrados', 'Errores Replay'],
          rows: [
            { cells: ['190.85.44.22 (Sede C)', isIpsec ? 'ESP AES-256' : 'GRE Clear', '14,820 pkts', '0'], status: isIpsec ? 'ok' : 'warn' },
          ],
        },
        syslog: {
          timestamp: '19:14:02.154',
          facility: 'CRYPTO',
          severity: 6,
          mnemonic: 'DECAP_OK',
          device: 'R-BORDE-A',
          message: `Paquete desencapsulado de Tunnel100 y entregado a ${srvWebIp} en VLAN 10.`,
        },
      },
    ];
  }

  // =========================================================================
  // 6. MPLS L3VPN, LDP Y FRR
  // =========================================================================
  if (scenarioId === 'mpls') {
    const cut = state.mplsFiberCut;
    return [
      {
        index: 0,
        title: `Ingreso al PE-01: Imposición de doble etiqueta MPLS (Push)`,
        explanation: `${sedeA.city} envía tráfico IP dentro de la VRF-NGN-CORP. El router PE-01 consulta la tabla VRF (MP-BGP VPNv4) e impone dos etiquetas: etiqueta VPN interna (200) y etiqueta de transporte LDP externa (24018).`,
        fromNode: 'R_SEDE_A',
        toNode: 'PE_01',
        pathPoints: ['HOST_A', 'SW_SEDE_A', 'R_SEDE_A', 'PE_01'],
        packetLabel: 'Push Labels [24018 | 200]',
        transformationBadge: 'MPLS Push (2 etiquetas)',
        packetColor: '#7C3AED',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet',
            osiLayer: 'L2 Enlace',
            bytes: 14,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: 'EtherType 0x8847 (MPLS Unicast)',
            fields: [{ label: 'EtherType', value: '0x8847 (MPLS)' }],
          },
          {
            id: 'mpls_ldp',
            name: 'MPLS LDP (Ext)',
            osiLayer: 'L2.5 Transporte',
            bytes: 4,
            color: '#7C3AED',
            textColor: '#FFFFFF',
            summary: 'Label=24018 · EXP=5 · S=0',
            fields: [
              { label: 'Label (20b)', value: '24018 (LDP hacia PE-02)', highlight: true },
              { label: 'EXP (3b)', value: '5 (EF)' },
              { label: 'S (BoS)', value: '0 (Hay más etiquetas)' },
            ],
          },
          {
            id: 'mpls_vpn',
            name: 'MPLS VPN (Int)',
            osiLayer: 'L2.5 Servicio',
            bytes: 4,
            color: '#9333EA',
            textColor: '#FFFFFF',
            summary: 'Label=200 · S=1 (VRF)',
            fields: [
              { label: 'Label (20b)', value: '200 (MP-BGP RD 65100:101)', highlight: true },
              { label: 'S (BoS)', value: '1 (Fondo de pila)' },
            ],
          },
          {
            id: 'ip',
            name: 'IPv4 Cliente',
            osiLayer: 'L3 VRF',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: `${prefix}.${sedeA.subnetOctet * 2}.10 → ${srvWebIp}`,
            fields: [{ label: 'VRF', value: 'VRF-NGN-CORP' }],
          },
          {
            id: 'data',
            name: 'TCP + Datos',
            osiLayer: 'L4-L7',
            bytes: 520,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: '520 B',
            fields: [{ label: 'Carga útil', value: '520 bytes' }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'FCS', value: '0x7109AD2F' }],
          },
        ],
        metrics: buildMetrics('Core MPLS 10 Gbps', [{ bytes: 14, isL2: true }, { bytes: 8, isL2: true }, { bytes: 20 }, { bytes: 520 }, { bytes: 4, isL2: true }], 1524, 10000),
        contextualState: {
          title: 'Tabla LFIB / VRF en PE-01',
          subtitle: 'Distribución LDP + MP-BGP VPNv4',
          columns: ['Prefijo / Label In', 'Acción', 'Label Out', 'Next-Hop'],
          rows: [
            { cells: [`${prefix}.10.0/24 (VRF)`, 'PUSH', '24018 (LDP) + 200 (VPN)', 'P-01 (10.254.1.2)'], status: 'ok' },
            { cells: ['Tunnel50 (FRR Backup)', 'READY', 'Bypass 24099', 'P-02 (10.254.2.2)'], status: 'info' },
          ],
        },
        syslog: {
          timestamp: '19:16:10.004',
          facility: 'MPLS_LDP',
          severity: 6,
          mnemonic: 'LABEL_PUSH',
          device: 'PE-01',
          message: `VRF-NGN-CORP: Push labels [24018 | 200] hacia P-01 para destino ${srvWebIp}.`,
        },
      },
      {
        index: 1,
        title: cut
          ? 'CORTE DE FIBRA PE-01↔P-01: MPLS TE-FRR desvía por P-02 en 34 ms'
          : 'Conmutación en Núcleo P-01 (Swap) y Penultimate Hop Popping (PHP)',
        explanation: cut
          ? `¡Corte de fibra detectado en el enlace primario PE-01 ↔ P-01! Antes de esperar la reconvergencia OSPF, el PLR (Point of Local Repair) activa el túnel de respaldo MPLS TE-FRR (Label 24099) desviando por P-02 en 34 ms (< 50 ms SLA).`
          : `El router P-01 conmuta exclusivamente por etiqueta (Swap 24018 → 24032) sin inspeccionar IP, y en el penúltimo salto hacia el borde ejecuta PHP (Pop) retirando la etiqueta externa para optimizar el egreso.`,
        fromNode: 'PE_01',
        toNode: cut ? 'P_02' : 'P_01',
        pathPoints: cut ? ['PE_01', 'P_02', 'R_BORDE_A'] : ['PE_01', 'P_01', 'R_BORDE_A'],
        packetLabel: cut ? 'FRR Bypass 34 ms (Label 24099)' : 'Swap 24018→24032 · PHP',
        transformationBadge: cut ? 'TE-FRR < 50 ms (34 ms)' : 'Swap + PHP',
        packetColor: cut ? '#D97706' : '#7C3AED',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet',
            osiLayer: 'L2 Enlace',
            bytes: 14,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: cut ? 'Ruta Backup P-02' : 'Ruta Primaria P-01',
            fields: [{ label: 'Interfaz', value: cut ? 'Gi0/1 → P-02 (Bypass)' : 'Gi0/0 → P-01' }],
          },
          {
            id: 'mpls_ldp',
            name: cut ? 'FRR Bypass Label' : 'MPLS Swap',
            osiLayer: 'L2.5 Núcleo',
            bytes: 4,
            color: cut ? '#D97706' : '#7C3AED',
            textColor: '#FFFFFF',
            summary: cut ? 'Label=24099 (Bypass FRR)' : 'Label=24032 (Swap) → PHP',
            fields: [
              { label: 'Etiqueta Transporte', value: cut ? '24099 (TE-FRR Tunnel50)' : '24032 (Swap en P-01)', highlight: true },
              { label: 'Tiempo Conmutación', value: cut ? '34 ms (Cumple < 50 ms)' : '0 ms' },
            ],
          },
          {
            id: 'mpls_vpn',
            name: 'MPLS VPN (Int)',
            osiLayer: 'L2.5 Servicio',
            bytes: 4,
            color: '#9333EA',
            textColor: '#FFFFFF',
            summary: 'Label=200 intacta',
            fields: [{ label: 'Label VPN', value: '200 (Sin modificar en P)' }],
          },
          {
            id: 'ip',
            name: 'IPv4 Cliente',
            osiLayer: 'L3 VRF',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: 'Transparente para routers P',
            fields: [{ label: 'Inspección IP en P', value: 'No requerida (Solo LFIB)' }],
          },
          {
            id: 'data',
            name: 'TCP + Datos',
            osiLayer: 'L4-L7',
            bytes: 520,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: '520 B',
            fields: [{ label: 'Carga útil', value: '520 B' }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'FCS', value: '0x22AC9104' }],
          },
        ],
        metrics: buildMetrics(cut ? 'Enlace Bypass FRR P-02 (10 Gbps)' : 'Core P-01 (10 Gbps)', [{ bytes: 14, isL2: true }, { bytes: 8, isL2: true }, { bytes: 20 }, { bytes: 520 }, { bytes: 4, isL2: true }], 1524, 10000),
        contextualState: {
          title: 'Estado MPLS Core & Fast Reroute',
          subtitle: cut ? 'Falla física mitigada por TE-FRR' : 'Conmutación LDP nominal',
          columns: ['Salto', 'Operación LFIB', 'Pila de Etiquetas', 'Tiempo'],
          rows: [
            { cells: ['PE-01 (Ingress)', 'Push', '[24018 | 200]', '0.2 ms'], status: 'ok' },
            { cells: [cut ? 'PE-01 → P-02 (FRR)' : 'P-01 (Transit)', cut ? 'FRR Bypass Swap' : 'LDP Swap + PHP', cut ? '[24099 | 200]' : '[200]', cut ? '34 ms (Failover)' : '0.4 ms'], status: cut ? 'warn' : 'ok' },
            { cells: ['Egreso DC', 'Pop VPN 200', 'IP Nativo VRF', '0.1 ms'], status: 'ok' },
          ],
        },
        syslog: cut
          ? {
              timestamp: '19:16:10.034',
              facility: 'MPLS_TE',
              severity: 4,
              mnemonic: 'FRR_ACTIVE',
              device: 'PE-01',
              message: `CORTE FIBRA Gi0/0! Fast Reroute activado en 34ms vía Tunnel50 (P-02). Cero pérdida de sesiones VPNv4.`,
            }
          : {
              timestamp: '19:16:10.012',
              facility: 'MPLS_LDP',
              severity: 6,
              mnemonic: 'LFIB_SWAP',
              device: 'P-01',
              message: `LFIB Swap 24018->24032 (PHP Pop hacia borde DC). VPN label 200 preservada.`,
            },
      },
      {
        index: 2,
        title: 'Pop de etiqueta VPN y entrega en VRF Datacenter',
        explanation: `El borde de salida retira la etiqueta VPN 200 (Pop), asocia la trama a VRF-NGN-CORP y entrega el paquete IP limpio hacia ${srvWebIp}.`,
        fromNode: 'R_BORDE_A',
        toNode: 'SRV_WEB',
        pathPoints: ['R_BORDE_A', 'SW_CORE', 'SRV_WEB'],
        packetLabel: 'Pop VPN 200 → IP Nativo',
        transformationBadge: 'MPLS Pop → IPv4',
        packetColor: '#059669',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet 802.1Q',
            osiLayer: 'L2 Enlace',
            bytes: 18,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: 'EtherType 0x0800 (IPv4)',
            fields: [{ label: 'VLAN', value: '10 (Datacenter)' }],
          },
          {
            id: 'ip',
            name: 'IPv4 VRF',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: '#0284C7',
            textColor: '#FFFFFF',
            summary: `${prefix}.${sedeA.subnetOctet * 2}.10 → ${srvWebIp}`,
            fields: [{ label: 'Destino', value: srvWebIp }],
          },
          {
            id: 'data',
            name: 'TCP + Datos',
            osiLayer: 'L4-L7',
            bytes: 520,
            color: '#059669',
            textColor: '#FFFFFF',
            summary: '520 B entregados',
            fields: [{ label: 'SLA MPLS', value: cut ? 'Recuperado < 50ms' : 'Nominal' }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'FCS', value: '0x9A810C4E' }],
          },
        ],
        metrics: buildMetrics('Core Datacenter 10 Gbps', [{ bytes: 18, isL2: true }, { bytes: 20 }, { bytes: 520 }, { bytes: 4, isL2: true }], 1500, 10000),
        contextualState: {
          title: 'Resumen SLA MPLS L3VPN',
          subtitle: 'Aislamiento y Convergencia',
          columns: ['Parámetro', 'Valor medido', 'Umbral'],
          rows: [
            { cells: ['Aislamiento VRF', 'VRF-NGN-CORP (65100:101)', '100% Aislado'], status: 'ok' },
            { cells: ['Recuperación corte fibra', cut ? '34 ms (TE-FRR)' : 'N/A (Enlace OK)', '< 50 ms'], status: 'ok' },
          ],
        },
        syslog: {
          timestamp: '19:16:10.041',
          facility: 'BGP_VPNV4',
          severity: 6,
          mnemonic: 'DELIVERED',
          device: 'R-BORDE-A',
          message: `Etiqueta VPN 200 removida. Paquete VRF-NGN-CORP entregado a ${srvWebIp}.`,
        },
      },
    ];
  }

  // =========================================================================
  // 7. QOS DIFFSERV: LLQ, CBWFQ Y WRED
  // =========================================================================
  if (scenarioId === 'qos') {
    const isDiffServ = state.qosMode === 'diffserv';
    const wanBw = state.qosWanSpeedMbps;
    const congestionFactor = wanBw < 35 ? 'Alta congestión (96%)' : wanBw < 65 ? 'Carga moderada (72%)' : 'Carga holgada (45%)';
    const voiceLatency = isDiffServ
      ? Number((8.5 + (100 - wanBw) * 0.08).toFixed(1))
      : Number((22 + (100 - wanBw) * 1.45).toFixed(1));
    const voiceJitter = isDiffServ ? 1.6 : Number((6.2 + (100 - wanBw) * 0.35).toFixed(1));
    const voiceLoss = isDiffServ ? 0.0 : Number(((100 - wanBw) * 0.045).toFixed(2));
    const slaOk = voiceLatency <= design.policies.slaLatencyVoiceMs && voiceLoss <= design.policies.slaLossPct;

    return [
      {
        index: 0,
        title: `Clasificación y marcado DSCP en ${sedeB.city}`,
        explanation: `Coexisten tres flujos en la LAN de ${sedeB.name}: Voz/Telemedicina (marcado DSCP EF = 46), Video conferencia (AF41 = 34) y respaldo ERP/HTTP masivo (Best Effort = 0) compitiendo por un enlace WAN de ${wanBw} Mbps.`,
        fromNode: 'HOST_B',
        toNode: 'R_SEDE_B',
        pathPoints: ['HOST_B', 'SW_SEDE_B', 'R_SEDE_B'],
        packetLabel: isDiffServ ? 'Marcado DSCP EF (46)' : 'Sin QoS (DSCP 0)',
        packetColor: isDiffServ ? '#059669' : '#D97706',
        layers: [
          {
            id: 'eth',
            name: 'Ethernet 802.1Q',
            osiLayer: 'L2 Enlace',
            bytes: 18,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: isDiffServ ? 'CoS=5 (Voz)' : 'CoS=0 (Best Effort)',
            fields: [
              { label: 'VLAN Voz', value: `${sedeB.vlanBase + 1}` },
              { label: '802.1p CoS', value: isDiffServ ? '5 (Prioridad Crítica)' : '0', highlight: true },
            ],
          },
          {
            id: 'ip',
            name: 'IPv4 DiffServ',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: isDiffServ ? '#059669' : '#D97706',
            textColor: '#FFFFFF',
            summary: isDiffServ ? 'DSCP=EF (46)' : 'DSCP=BE (0)',
            fields: [
              { label: 'ToS / DSCP', value: isDiffServ ? 'EF (46 / 0xB8)' : '0 (Sin clasificar)', highlight: true },
              { label: 'Origen → Destino', value: `${prefix}.${sedeB.subnetOctet * 2}.22 → ${srvWebIp}` },
            ],
          },
          {
            id: 'udp',
            name: 'UDP + RTP',
            osiLayer: 'L4-L5 Media',
            bytes: 20,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: 'RTP G.711 Voz',
            fields: [{ label: 'Puertos UDP', value: '16384 → 16384 (RTP)' }],
          },
          {
            id: 'data',
            name: 'Audio RTP 20ms',
            osiLayer: 'L7 Media',
            bytes: 160,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: '160 bytes (64 kbps)',
            fields: [{ label: 'Codec', value: 'G.711 ulaw (20 ms/pkt)' }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'FCS', value: '0x1C3B9802' }],
          },
        ],
        metrics: buildMetrics(`LAN ${sedeB.city}`, [{ bytes: 18, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: 160 }, { bytes: 4, isL2: true }], 1500, 1000),
        contextualState: {
          title: 'Ocupación de Colas en R-SEDE-B',
          subtitle: `Enlace WAN: ${wanBw} Mbps (${congestionFactor})`,
          columns: ['Clase / Cola', 'Mecanismo', 'Ancho Banda', 'Estado'],
          rows: isDiffServ
            ? [
                { cells: ['CM-VOZ-EF (DSCP 46)', 'LLQ (Prioridad estricta)', '30% garantizado', '0% Drop'], status: 'ok' },
                { cells: ['CM-VIDEO-AF41', 'CBWFQ + WRED', '35% garantizado', 'Estable'], status: 'ok' },
                { cells: ['CM-ERP-AF21 + BE', 'CBWFQ + WRED', '35% restante', wanBw < 40 ? 'WRED activo' : 'Normal'], status: wanBw < 40 ? 'warn' : 'ok' },
              ]
            : [
                { cells: ['Cola Única FIFO', 'First-In First-Out', '100% compartido', wanBw < 60 ? 'Saturación / Tail-Drop' : 'Normal'], status: wanBw < 60 ? 'err' : 'warn' },
              ],
        },
        syslog: {
          timestamp: '19:18:40.005',
          facility: 'QOS',
          severity: isDiffServ ? 6 : 4,
          mnemonic: isDiffServ ? 'CLASSIFY_EF' : 'FIFO_BUFFERBLOAT',
          device: 'R-SEDE-B',
          message: isDiffServ
            ? `Paquete RTP clasificado en CM-VOZ-EF (DSCP 46) hacia cola LLQ.`
            : `Cola única FIFO sin clasificación DiffServ en Serial0/0/0 (${wanBw} Mbps).`,
        },
      },
      {
        index: 1,
        title: isDiffServ
          ? `Planificador LLQ adelanta la voz sobre ráfagas ERP/HTTP (SLA OK)`
          : `Cola FIFO saturada: ráfagas masivas retrasan y descartan paquetes de voz`,
        explanation: isDiffServ
          ? `Aunque una transferencia masiva ocupa la cola default, WRED descarta suavemente paquetes TCP elásticos antes de saturar, mientras LLQ despacha inmediatamente la trama de voz (${voiceLatency} ms latencia, ${voiceJitter} ms jitter).`
          : `En FIFO sin QoS, los paquetes grandes de 1500 B monopolizan el buffer de salida. La voz espera detrás de la ráfaga sufriendo ${voiceLatency} ms de latencia, ${voiceJitter} ms de jitter y ${voiceLoss}% de pérdida por Tail-Drop.`,
        fromNode: 'R_SEDE_B',
        toNode: 'R_BORDE_A',
        pathPoints: ['R_SEDE_B', 'PE_01', 'P_01', 'R_BORDE_A', 'SW_CORE', 'SRV_WEB'],
        packetLabel: isDiffServ ? `LLQ EF: ${voiceLatency} ms OK` : `FIFO Saturado: ${voiceLatency} ms ⚠`,
        transformationBadge: isDiffServ ? 'LLQ Prioritario (0% Drop)' : slaOk ? 'FIFO Bajo Carga' : 'SLA Violado (Tail-Drop)',
        packetColor: slaOk ? '#059669' : '#DC2626',
        layers: [
          {
            id: 'ppp',
            name: 'PPP + QoS',
            osiLayer: 'L2 Enlace',
            bytes: 4,
            color: '#475569',
            textColor: '#FFFFFF',
            summary: isDiffServ ? 'Despacho inmediato LLQ' : 'Espera en cola FIFO',
            fields: [{ label: 'Serialización', value: `${serializeUs(204, wanBw)} µs en ${wanBw} Mbps` }],
          },
          {
            id: 'ip',
            name: 'IPv4',
            osiLayer: 'L3 Red',
            bytes: 20,
            color: slaOk ? '#059669' : '#DC2626',
            textColor: '#FFFFFF',
            summary: isDiffServ ? 'DSCP EF (46)' : 'DSCP BE (0)',
            fields: [
              { label: 'Latencia Medida', value: `${voiceLatency} ms`, highlight: !slaOk },
              { label: 'Jitter', value: `${voiceJitter} ms`, highlight: !slaOk },
            ],
          },
          {
            id: 'udp',
            name: 'UDP + RTP',
            osiLayer: 'L4-L5 Media',
            bytes: 20,
            color: '#0D9488',
            textColor: '#FFFFFF',
            summary: 'RTP Voz',
            fields: [{ label: 'Pérdida Paquetes', value: `${voiceLoss}%`, highlight: !slaOk }],
          },
          {
            id: 'data',
            name: 'Audio RTP',
            osiLayer: 'L7 Media',
            bytes: 160,
            color: '#2563EB',
            textColor: '#FFFFFF',
            summary: slaOk ? 'Audio nítido (MOS 4.3)' : 'Audio entrecortado (MOS 2.6)',
            fields: [{ label: 'Calidad MOS', value: slaOk ? '4.3 / 5.0' : '2.6 / 5.0' }],
          },
          {
            id: 'fcs',
            name: 'FCS',
            osiLayer: 'L2 Cola',
            bytes: 4,
            color: '#334155',
            textColor: '#FFFFFF',
            summary: 'CRC-32',
            fields: [{ label: 'FCS', value: '0x7710E90A' }],
          },
        ],
        metrics: buildMetrics(`WAN ${sedeB.city} (${wanBw} Mbps)`, [{ bytes: 4, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: 160 }, { bytes: 4, isL2: true }], 1500, wanBw),
        contextualState: {
          title: 'Cumplimiento de SLA Voz / Telemedicina',
          subtitle: `Umbral diseño: Latencia ≤ ${design.policies.slaLatencyVoiceMs} ms · Pérdida ≤ ${design.policies.slaLossPct}%`,
          columns: ['Indicador', 'Valor Medido', 'Umbral SLA', 'Estado'],
          rows: [
            { cells: ['Latencia One-Way', `${voiceLatency} ms`, `≤ ${design.policies.slaLatencyVoiceMs} ms`, voiceLatency <= design.policies.slaLatencyVoiceMs ? 'CUMPLE' : 'EXCEDIDO'], status: voiceLatency <= design.policies.slaLatencyVoiceMs ? 'ok' : 'err' },
            { cells: ['Jitter', `${voiceJitter} ms`, '≤ 10.0 ms', voiceJitter <= 10 ? 'CUMPLE' : 'EXCEDIDO'], status: voiceJitter <= 10 ? 'ok' : 'err' },
            { cells: ['Pérdida de paquetes', `${voiceLoss}%`, `≤ ${design.policies.slaLossPct}%`, voiceLoss <= design.policies.slaLossPct ? 'CUMPLE' : 'TAIL-DROP'], status: voiceLoss <= design.policies.slaLossPct ? 'ok' : 'err' },
          ],
        },
        syslog: slaOk
          ? {
              timestamp: '19:18:40.021',
              facility: 'QOS',
              severity: 6,
              mnemonic: 'SLA_COMPLIANT',
              device: 'R-SEDE-B',
              message: `Cola LLQ EF estable: latencia=${voiceLatency}ms, jitter=${voiceJitter}ms, drops=0. WRED regulando TCP bulk.`,
            }
          : {
              timestamp: '19:18:40.095',
              facility: 'QOS',
              severity: 3,
              mnemonic: 'SLA_BREACH_FIFO',
              device: 'R-SEDE-B',
              message: `ALERTA SLA: Bufferbloat en FIFO (${wanBw} Mbps). Latencia=${voiceLatency}ms, pérdida=${voiceLoss}% por Tail-Drop.`,
            },
      },
    ];
  }

  // =========================================================================
  // 8. VIAJE NGN EXTREMO A EXTREMO (SEDE C -> GPON -> IPSEC -> MPLS -> HSRP -> DC)
  // =========================================================================
  const rtpBytes = state.ngnCodec === 'G.711' ? 160 : 40;
  return [
    {
      index: 0,
      title: `1/4 Acceso Sede C: Telemedicina marcada EF y Relay DHCP en túnel`,
      explanation: `La estación médica en ${sedeC.city} obtuvo su IP vía DHCP Relay sobre el túnel y envía una trama de telemedicina RTP (${state.ngnCodec}) marcada con DSCP EF (46) hacia el switch y router de Sede C.`,
      fromNode: 'HOST_C',
      toNode: 'R_SEDE_C',
      pathPoints: ['HOST_C', 'SW_SEDE_C', 'R_SEDE_C'],
      packetLabel: `RTP ${state.ngnCodec} (DSCP EF)`,
      packetColor: '#0284C7',
      layers: [
        { id: 'eth', name: 'Ethernet 802.1Q', osiLayer: 'L2', bytes: 18, color: '#475569', textColor: '#FFFFFF', summary: `VLAN ${sedeC.vlanBase + 1} · CoS=5`, fields: [{ label: 'VLAN Voz', value: `${sedeC.vlanBase + 1}` }] },
        { id: 'ip', name: 'IPv4 EF', osiLayer: 'L3', bytes: 20, color: '#0284C7', textColor: '#FFFFFF', summary: `DSCP=46 (EF)`, fields: [{ label: 'Origen', value: `${prefix}.${sedeC.subnetOctet * 2}.18` }, { label: 'Destino', value: srvWebIp }] },
        { id: 'udp', name: 'UDP+RTP', osiLayer: 'L4-L5', bytes: 20, color: '#0D9488', textColor: '#FFFFFF', summary: 'RTP Audio', fields: [{ label: 'Codec', value: state.ngnCodec }] },
        { id: 'data', name: 'Telemedicina', osiLayer: 'L7', bytes: rtpBytes, color: '#2563EB', textColor: '#FFFFFF', summary: `${rtpBytes} B`, fields: [{ label: 'Payload', value: `${rtpBytes} bytes` }] },
        { id: 'fcs', name: 'FCS', osiLayer: 'L2', bytes: 4, color: '#334155', textColor: '#FFFFFF', summary: 'CRC-32', fields: [{ label: 'FCS', value: '0x2180AA11' }] },
      ],
      metrics: buildMetrics(`LAN ${sedeC.city}`, [{ bytes: 18, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: rtpBytes }, { bytes: 4, isL2: true }], 1500, 1000),
      contextualState: {
        title: 'Presupuesto de Latencia NGN Extremo a Extremo',
        subtitle: 'Tramo 1: LAN Sede C',
        columns: ['Tramo', 'Tecnología', 'Latencia acumulada', 'Presupuesto'],
        rows: [
          { cells: ['LAN Sede C', '802.1Q CoS 5 + DSCP EF', '0.6 ms', '< 2 ms'], status: 'ok' },
          { cells: ['Acceso GPON', 'T-CONT 1 + GEM (Pendiente)', '---', '< 5 ms'], status: 'info' },
        ],
      },
      syslog: {
        timestamp: '19:22:01.001',
        facility: 'NGN_E2E',
        severity: 6,
        mnemonic: 'MED_STREAM_TX',
        device: 'R-SEDE-C',
        message: `Flujo telemedicina ${state.ngnCodec} (DSCP EF) desde ${sedeC.city} entrando a Tunnel0.`,
      },
    },
    {
      index: 1,
      title: `2/4 Cifrado IPsec + PPPoE y transporte óptico GPON (T-CONT EF)`,
      explanation: `R-SEDE-C cifra el paquete en GRE/IPsec ESP (AES-256), añade cabecera PPPoE y la ONT lo encapsula en tramas GEM prioritarias (T-CONT Tipo 1) cruzando el Splitter 1:32 hacia la OLT-01.`,
      fromNode: 'R_SEDE_C',
      toNode: 'OLT_01',
      pathPoints: ['R_SEDE_C', 'ONT_C', 'SPLITTER', 'OLT_01'],
      packetLabel: 'GPON GEM + PPPoE + IPsec EF',
      transformationBadge: 'Cifrado ESP + GEM T-CONT1',
      packetColor: '#059669',
      layers: [
        { id: 'gem', name: 'GPON GEM+Eth', osiLayer: 'L2 Óptico', bytes: 19, color: '#475569', textColor: '#FFFFFF', summary: 'GEM Port 101 (T-CONT 1)', fields: [{ label: 'DBA GPON', value: 'Fixed Bandwidth EF' }] },
        { id: 'pppoe', name: 'PPPoE+PPP', osiLayer: 'L2 Sesión', bytes: 8, color: '#7C3AED', textColor: '#FFFFFF', summary: 'Session 0x1A4F', fields: [{ label: 'MTU', value: '1492 B' }] },
        { id: 'ip_ext', name: 'IP Delivery', osiLayer: 'L3 Pública', bytes: 20, color: '#0284C7', textColor: '#FFFFFF', summary: 'Proto 50 (ESP)', fields: [{ label: 'DSCP Copiado', value: 'EF (ToS Byte Preserve)', highlight: true }] },
        { id: 'esp', name: 'IPsec ESP+GRE', osiLayer: 'L3 Seguridad', bytes: 56, color: '#059669', textColor: '#FFFFFF', summary: 'AES-256-GCM', fields: [{ label: 'Cifrado', value: 'Protegido' }] },
        { id: 'inner', name: `RTP ${state.ngnCodec} Cifrado`, osiLayer: 'L4-L7', bytes: 40 + rtpBytes, color: '#1E293B', textColor: '#FFFFFF', summary: `${40 + rtpBytes} B`, fields: [{ label: 'Payload', value: 'Cifrado en tránsito' }] },
        { id: 'fcs', name: 'FCS', osiLayer: 'L2', bytes: 4, color: '#334155', textColor: '#FFFFFF', summary: 'CRC-32', fields: [{ label: 'FCS', value: '0x80F12219' }] },
      ],
      metrics: buildMetrics(`GPON FTTH ${sedeC.city} (2.488G/1.244G)`, [{ bytes: 27, isL2: true }, { bytes: 20 }, { bytes: 56 }, { bytes: 40 + rtpBytes }, { bytes: 4, isL2: true }], 1492, sedeC.capacityMbps),
      contextualState: {
        title: 'Presupuesto de Latencia NGN Extremo a Extremo',
        subtitle: 'Tramo 2: Acceso GPON + Túnel IPsec',
        columns: ['Tramo', 'Mecanismo', 'Latencia acumulada', 'Estado'],
        rows: [
          { cells: ['LAN Sede C', '802.1Q + DSCP EF', '0.6 ms', 'OK'], status: 'ok' },
          { cells: ['GPON + IPsec', 'GEM T-CONT1 + ESP AES-256', '4.8 ms', 'Cifrado & Prioritario'], status: 'ok' },
        ],
      },
      syslog: {
        timestamp: '19:22:01.006',
        facility: 'GPON',
        severity: 6,
        mnemonic: 'ONT_TCONT_EF',
        device: 'OLT-01',
        message: `ONU-12 (${sedeC.city}) recibió ráfaga upstream T-CONT1 (GEM 101) sin colisiones DBA.`,
      },
    },
    {
      index: 2,
      title: '3/4 Núcleo MPLS L3VPN con mapa EXP=5 y protección TE-FRR',
      explanation: `PE-01 mapea el bit DSCP EF al campo MPLS EXP=5 en las etiquetas [24018 | 200]. El núcleo P-01 conmuta el tráfico en cola prioritaria hacia el borde del Datacenter.`,
      fromNode: 'OLT_01',
      toNode: 'R_BORDE_A',
      pathPoints: ['OLT_01', 'PE_01', 'P_01', 'R_BORDE_A'],
      packetLabel: 'MPLS EXP=5 [24018|200]',
      transformationBadge: 'MPLS Push (EXP=5)',
      packetColor: '#7C3AED',
      layers: [
        { id: 'eth', name: 'Ethernet', osiLayer: 'L2', bytes: 14, color: '#475569', textColor: '#FFFFFF', summary: '0x8847 MPLS', fields: [{ label: 'Type', value: '0x8847' }] },
        { id: 'mpls', name: 'MPLS [LDP|VPN]', osiLayer: 'L2.5', bytes: 8, color: '#7C3AED', textColor: '#FFFFFF', summary: 'EXP=5 · FRR Ready', fields: [{ label: 'MPLS EXP', value: '5 (Prioridad Estricta)', highlight: true }] },
        { id: 'ip_ext', name: 'IP ESP', osiLayer: 'L3', bytes: 20, color: '#0284C7', textColor: '#FFFFFF', summary: 'Proto 50 (ESP)', fields: [{ label: 'Protocolo', value: '50' }] },
        { id: 'esp', name: 'IPsec+GRE', osiLayer: 'L3 Sec', bytes: 56, color: '#059669', textColor: '#FFFFFF', summary: 'AES-256', fields: [{ label: 'SA', value: '0x8F11C204' }] },
        { id: 'inner', name: 'RTP Cifrado', osiLayer: 'L4-L7', bytes: 40 + rtpBytes, color: '#1E293B', textColor: '#FFFFFF', summary: `${40 + rtpBytes} B`, fields: [{ label: 'Payload', value: 'Cifrado' }] },
        { id: 'fcs', name: 'FCS', osiLayer: 'L2', bytes: 4, color: '#334155', textColor: '#FFFFFF', summary: 'CRC-32', fields: [{ label: 'FCS', value: '0x553011AC' }] },
      ],
      metrics: buildMetrics('Core MPLS 10 Gbps', [{ bytes: 22, isL2: true }, { bytes: 20 }, { bytes: 56 }, { bytes: 40 + rtpBytes }, { bytes: 4, isL2: true }], 1524, 10000),
      contextualState: {
        title: 'Presupuesto de Latencia NGN Extremo a Extremo',
        subtitle: 'Tramo 3: Núcleo MPLS EXP=5',
        columns: ['Tramo', 'Mecanismo', 'Latencia acumulada', 'Estado'],
        rows: [
          { cells: ['LAN + GPON + IPsec', 'T-CONT 1 + ESP', '4.8 ms', 'OK'], status: 'ok' },
          { cells: ['Núcleo MPLS', `LDP EXP=5 (${sedeC.distanceKm} km)`, `${(4.8 + sedeC.distanceKm * 0.011).toFixed(1)} ms`, 'OK (< 50 ms FRR)'], status: 'ok' },
        ],
      },
      syslog: {
        timestamp: '19:22:01.014',
        facility: 'MPLS_QOS',
        severity: 6,
        mnemonic: 'EXP5_FWD',
        device: 'P-01',
        message: `Conmutando etiqueta LDP 24018->24032 con EXP=5 prioritario hacia Datacenter.`,
      },
    },
    {
      index: 3,
      title: `4/4 Borde HSRP Active descifra y entrega al Servidor de Telemedicina`,
      explanation: `R-BORDE-A (Active HSRP ${hsrpVip}) retira las cabeceras IPsec/GRE, verifica integridad SHA-256 y entrega el audio/video de telemedicina en VLAN 10 hacia SRV-WEB/TELEMED (${srvWebIp}).`,
      fromNode: 'R_BORDE_A',
      toNode: 'SRV_WEB',
      pathPoints: ['R_BORDE_A', 'SW_CORE', 'SRV_WEB'],
      packetLabel: `Entregado (${(5.2 + sedeC.distanceKm * 0.011).toFixed(1)} ms E2E)`,
      transformationBadge: 'SLA E2E Verificado',
      packetColor: '#059669',
      layers: [
        { id: 'eth', name: 'Ethernet 802.1Q', osiLayer: 'L2', bytes: 18, color: '#475569', textColor: '#FFFFFF', summary: 'VLAN 10 Core', fields: [{ label: 'Gateway HSRP', value: hsrpVip }] },
        { id: 'ip', name: 'IPv4 EF', osiLayer: 'L3', bytes: 20, color: '#059669', textColor: '#FFFFFF', summary: `DSCP EF → ${srvWebIp}`, fields: [{ label: 'Destino', value: srvWebIp }] },
        { id: 'udp', name: 'UDP+RTP', osiLayer: 'L4-L5', bytes: 20, color: '#0D9488', textColor: '#FFFFFF', summary: state.ngnCodec, fields: [{ label: 'Jitter E2E', value: '1.8 ms' }] },
        { id: 'data', name: 'Telemedicina', osiLayer: 'L7', bytes: rtpBytes, color: '#059669', textColor: '#FFFFFF', summary: `${rtpBytes} B`, fields: [{ label: 'Calidad', value: 'MOS 4.35 · SLA OK' }] },
        { id: 'fcs', name: 'FCS', osiLayer: 'L2', bytes: 4, color: '#334155', textColor: '#FFFFFF', summary: 'CRC-32', fields: [{ label: 'FCS', value: '0xF90122A0' }] },
      ],
      metrics: buildMetrics('Core Datacenter 10 Gbps', [{ bytes: 18, isL2: true }, { bytes: 20 }, { bytes: 20 }, { bytes: rtpBytes }, { bytes: 4, isL2: true }], 1500, 10000),
      contextualState: {
        title: 'Resumen Presupuesto Extremo a Extremo',
        subtitle: `${sedeC.city} → Datacenter Central`,
        columns: ['Métrica NGN', 'Resultado', 'Umbral SLA', 'Estado'],
        rows: [
          { cells: ['Latencia total E2E', `${(5.2 + sedeC.distanceKm * 0.011).toFixed(1)} ms`, `≤ ${design.policies.slaLatencyVoiceMs} ms`, 'CUMPLE'], status: 'ok' },
          { cells: ['Jitter / Pérdida', '1.8 ms / 0.00%', `≤ ${design.policies.slaLossPct}%`, 'CUMPLE'], status: 'ok' },
          { cells: ['Seguridad & Redundancia', 'IPsec AES-256 + HSRP + MPLS FRR', 'Obligatorio', 'ACTIVO'], status: 'ok' },
        ],
      },
      syslog: {
        timestamp: '19:22:01.019',
        facility: 'TELEMED',
        severity: 6,
        mnemonic: 'E2E_SLA_PASS',
        device: 'SRV-WEB',
        message: `Sesión telemedicina ${state.ngnCodec} desde ${sedeC.city} entregada en ${(5.2 + sedeC.distanceKm * 0.011).toFixed(1)}ms. Todos los servicios NGN operativos.`,
      },
    },
  ];
}
