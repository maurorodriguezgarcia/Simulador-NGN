import { InfraDesign, ServiceTag, SiteNode } from '../types/network';
import { calculateCgnatOffload, calculateDesignVlsm } from './vlsm';

export interface CliLine {
  text: string;
  tags: ServiceTag[];
}

export interface CliDeviceConfig {
  id: string;
  hostname: string;
  roleLabel: string;
  group: 'parametric' | 'reference';
  technology: 'metroethernet' | 'mpls' | 'gpon' | 'core';
  lines: CliLine[];
}

function tagLines(rawLines: { text: string; tags?: ServiceTag[] }[]): CliLine[] {
  return rawLines.map((l) => ({ text: l.text, tags: l.tags || [] }));
}

export function generateSiteRouterCli(site: SiteNode, design: InfraDesign): CliDeviceConfig {
  const vlsm = calculateDesignVlsm(design).filter((r) => r.siteId === site.id);
  const dataSubnet = vlsm.find((v) => v.vlanName.includes('Datos')) || vlsm[0];
  const voiceSubnet = vlsm.find((v) => v.vlanName.includes('Voz')) || vlsm[1] || dataSubnet;
  const mgmtSubnet = vlsm.find((v) => v.vlanName.includes('Gestión')) || vlsm[2] || dataSubnet;

  const shortCity = site.city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);
  const hostname = site.isPrimaryHub ? `R-BORDE-DC-${shortCity}` : `R-SEDE-${shortCity}`;
  const prefix = design.baseNetworkPrefix;
  const dcDhcpIp = `${prefix}.10.10`;
  const siteNum = site.subnetOctet;

  const lines: { text: string; tags?: ServiceTag[] }[] = [
    { text: `! =========================================================` },
    { text: `! ${site.name} (${site.city}) — Tecnología: ${site.technology.toUpperCase()}` },
    { text: `! Capacidad WAN: ${site.capacityMbps} Mbps | Usuarios: ${site.users}` },
    ...(site.technology === 'gpon'
      ? [
          {
            text: `! ODN GPON: Clase ${site.gponOpticalClass || 'B+'} | Splitter ${site.splitterRatio || '1:32'} | Fibra ${site.distanceKm} km`,
          },
        ]
      : []),
    { text: `! =========================================================` },
    { text: `hostname ${hostname}` },
    { text: `ipv6 unicast-routing` },
    { text: `!` },
    { text: `ip dhcp snooping`, tags: ['DHCP'] },
    { text: `ip dhcp snooping vlan ${site.vlanBase},${site.vlanBase + 1}`, tags: ['DHCP'] },
    { text: `!` },
  ];

  if (design.policies.qosEnabled) {
    const cirBps = site.capacityMbps * 1000000;
    const voiceBw = Math.round(site.capacityMbps * 1000 * 0.3);
    const videoBw = Math.round(site.capacityMbps * 1000 * 0.35);
    lines.push(
      { text: `class-map match-any CM-VOZ-EF`, tags: ['QoS'] },
      { text: ` match dscp ef`, tags: ['QoS'] },
      { text: `class-map match-any CM-VIDEO-AF41`, tags: ['QoS'] },
      { text: ` match dscp af41`, tags: ['QoS'] },
      { text: `class-map match-any CM-ERP-AF21`, tags: ['QoS'] },
      { text: ` match dscp af21`, tags: ['QoS'] },
      { text: `!` },
      { text: `policy-map PM-WAN-DIFFSERV`, tags: ['QoS'] },
      { text: ` class CM-VOZ-EF`, tags: ['QoS'] },
      { text: `  priority ${voiceBw}`, tags: ['QoS'] },
      { text: ` class CM-VIDEO-AF41`, tags: ['QoS'] },
      { text: `  bandwidth ${videoBw}`, tags: ['QoS'] },
      { text: `  random-detect dscp-based`, tags: ['QoS'] },
      { text: ` class CM-ERP-AF21`, tags: ['QoS'] },
      { text: `  bandwidth remaining percent 40`, tags: ['QoS'] },
      { text: `  random-detect`, tags: ['QoS'] },
      { text: ` class class-default`, tags: ['QoS'] },
      { text: `  fair-queue`, tags: ['QoS'] },
      { text: `policy-map PM-SHAPER-WAN`, tags: ['QoS'] },
      { text: ` class class-default`, tags: ['QoS'] },
      { text: `  shape average ${cirBps}`, tags: ['QoS'] },
      { text: `  service-policy PM-WAN-DIFFSERV`, tags: ['QoS'] },
      { text: `!` }
    );
  }

  if (dataSubnet) {
    const v6Addr = dataSubnet.ipv6Prefix.split(' ')[0].replace('::/', '::1/');
    lines.push(
      { text: `interface GigabitEthernet0/0.${site.vlanBase}`, tags: ['DHCP', 'HSRP'] },
      { text: ` description LAN Datos - ${site.name}`, tags: ['DHCP'] },
      { text: ` encapsulation dot1Q ${site.vlanBase}`, tags: ['DHCP'] },
      { text: ` ip address ${dataSubnet.gateway} ${dataSubnet.mask}`, tags: ['DHCP'] },
      { text: ` ipv6 address ${v6Addr}`, tags: ['DHCP'] },
      { text: ` ip helper-address ${dcDhcpIp}`, tags: ['DHCP'] }
    );
    if (design.policies.hsrpEnabled && site.isPrimaryHub) {
      lines.push(
        { text: ` standby version 2`, tags: ['HSRP'] },
        { text: ` standby ${site.vlanBase} ip ${dataSubnet.gateway}`, tags: ['HSRP'] },
        { text: ` standby ${site.vlanBase} timers msec 250 msec 750`, tags: ['HSRP'] },
        { text: ` standby ${site.vlanBase} priority 110`, tags: ['HSRP'] },
        { text: ` standby ${site.vlanBase} preempt`, tags: ['HSRP'] },
        { text: ` standby ${site.vlanBase} track 1 decrement 20`, tags: ['HSRP'] }
      );
    }
    lines.push({ text: `!` });
  }

  if (voiceSubnet) {
    lines.push(
      { text: `interface GigabitEthernet0/0.${site.vlanBase + 1}`, tags: ['DHCP', 'QoS'] },
      { text: ` description LAN Voz y Telemedicina`, tags: ['QoS'] },
      { text: ` encapsulation dot1Q ${site.vlanBase + 1}`, tags: ['QoS'] },
      { text: ` ip address ${voiceSubnet.gateway} ${voiceSubnet.mask}`, tags: ['DHCP'] },
      { text: ` ip helper-address ${dcDhcpIp}`, tags: ['DHCP'] },
      { text: `!` }
    );
  }

  if (site.technology === 'gpon') {
    lines.push(
      { text: `interface GigabitEthernet0/1`, tags: ['PPP'] },
      { text: ` description Enlace hacia ONT GPON (${site.splitterRatio || '1:32'} · Clase ${site.gponOpticalClass || 'B+'})`, tags: ['PPP'] },
      { text: ` no ip address`, tags: ['PPP'] },
      { text: ` pppoe enable group global`, tags: ['PPP'] },
      { text: ` pppoe-client dial-pool-number 1`, tags: ['PPP'] },
      { text: `!` },
      { text: `interface Dialer1`, tags: ['PPP', 'NAT'] },
      { text: ` mtu 1492`, tags: ['PPP'] },
      { text: ` ip address negotiated`, tags: ['PPP'] },
      { text: ` ipv6 address dhcp`, tags: ['PPP', 'DHCP'] },
      { text: ` ipv6 dhcp client pd PD-GPON-${shortCity}`, tags: ['DHCP'] },
      { text: ` encapsulation ppp`, tags: ['PPP'] },
      { text: ` dialer pool 1`, tags: ['PPP'] },
      { text: ` ppp authentication chap callin`, tags: ['PPP'] },
      { text: ` ppp chap hostname ${shortCity}_ONT`, tags: ['PPP'] },
      { text: ` ip tcp adjust-mss 1452`, tags: ['PPP'] }
    );
    if (design.policies.internetExit === 'local') {
      lines.push({ text: ` ip nat outside`, tags: ['NAT'] });
    }
    if (design.policies.qosEnabled) {
      lines.push({ text: ` service-policy output PM-SHAPER-WAN`, tags: ['QoS'] });
    }
    lines.push({ text: `!` });
  } else if (site.technology === 'mpls') {
    lines.push(
      { text: `interface GigabitEthernet0/1`, tags: ['MPLS', 'QoS'] },
      { text: ` description Enlace PE MPLS L3VPN (${site.capacityMbps} Mbps)`, tags: ['MPLS'] },
      { text: ` ip address 172.16.${siteNum}.2 255.255.255.252`, tags: ['MPLS'] },
      { text: ` mpls ip`, tags: ['MPLS'] },
      { text: ` mpls ldp discovery transport-address interface`, tags: ['MPLS'] }
    );
    if (design.policies.qosEnabled) {
      lines.push({ text: ` service-policy output PM-SHAPER-WAN`, tags: ['QoS'] });
    }
    lines.push({ text: `!` });
  } else {
    lines.push(
      { text: `interface GigabitEthernet0/1`, tags: ['QoS', 'HSRP'] },
      { text: ` description Troncal MetroEthernet QinQ (${site.capacityMbps} Mbps)`, tags: ['QoS'] },
      { text: ` ip address 172.16.${siteNum}.2 255.255.255.252`, tags: ['HSRP'] },
      { text: ` mtu 1500`, tags: ['QoS'] }
    );
    if (design.policies.qosEnabled) {
      lines.push({ text: ` service-policy output PM-SHAPER-WAN`, tags: ['QoS'] });
    }
    lines.push({ text: `!` });
  }

  if (site.technology === 'gpon' && design.policies.ipsecOnGpon && !site.isPrimaryHub) {
    lines.push(
      { text: `crypto isakmp policy 10`, tags: ['VPN'] },
      { text: ` encr aes 256`, tags: ['VPN'] },
      { text: ` hash sha256`, tags: ['VPN'] },
      { text: ` authentication pre-share`, tags: ['VPN'] },
      { text: ` group 14`, tags: ['VPN'] },
      { text: `crypto ipsec transform-set TS-AES256 esp-aes 256 esp-sha256-hmac`, tags: ['VPN'] },
      { text: `crypto ipsec profile PROF-NGN-VPN`, tags: ['VPN'] },
      { text: ` set transform-set TS-AES256`, tags: ['VPN'] },
      { text: `!` },
      { text: `interface Tunnel0`, tags: ['VPN', 'DHCP'] },
      { text: ` description Tunel GRE/IPsec hacia Datacenter`, tags: ['VPN'] },
      { text: ` ip address 172.30.${siteNum}.2 255.255.255.252`, tags: ['VPN'] },
      { text: ` ip mtu 1400`, tags: ['VPN'] },
      { text: ` ip tcp adjust-mss 1360`, tags: ['VPN'] },
      { text: ` tunnel source Dialer1`, tags: ['VPN'] },
      { text: ` tunnel destination 200.14.80.10`, tags: ['VPN'] },
      { text: ` tunnel protection ipsec profile PROF-NGN-VPN`, tags: ['VPN'] },
      { text: `!` }
    );
  }

  if (design.policies.internetExit === 'local' || site.isPrimaryHub) {
    lines.push(
      { text: `ip access-list standard ACL-NAT-LAN`, tags: ['NAT'] },
      { text: ` permit ${dataSubnet ? dataSubnet.network : `${prefix}.${siteNum}.0`} 0.0.3.255`, tags: ['NAT'] },
      {
        text: `ip nat pool POOL-CGNAT 100.64.0.10 100.64.0.${10 + Math.max(2, Math.round(64 / design.policies.cgnatRatio))} netmask 255.255.255.0`,
        tags: ['NAT'],
      },
      { text: `ip nat inside source list ACL-NAT-LAN pool POOL-CGNAT overload`, tags: ['NAT'] },
      { text: `!` }
    );
  }

  if (mgmtSubnet) {
    lines.push(
      { text: `ip route 0.0.0.0 0.0.0.0 ${site.technology === 'gpon' ? 'Dialer1' : `172.16.${siteNum}.1`}` },
      { text: `logging host ${dcDhcpIp.replace('.10', '.50')}` },
      { text: `end` }
    );
  }

  return {
    id: site.id,
    hostname,
    roleLabel: `${site.city} · ${site.technology.toUpperCase()}`,
    group: 'parametric',
    technology: site.technology,
    lines: tagLines(lines),
  };
}

export function generateReferenceConfigs(
  design: InfraDesign,
  sedeA: SiteNode,
  sedeB: SiteNode,
  sedeC: SiteNode
): CliDeviceConfig[] {
  const p = design.baseNetworkPrefix;
  const devices: CliDeviceConfig[] = [
    {
      id: 'ref-borde-a',
      hostname: 'R-BORDE-A (Activo HSRP / NAT / Dual-Stack)',
      roleLabel: 'Datacenter Principal · Borde Primario',
      group: 'reference',
      technology: 'core',
      lines: tagLines([
        { text: `! Router de Borde Primario Datacenter (${design.orgName})` },
        { text: `hostname R-BORDE-A` },
        { text: `ipv6 unicast-routing` },
        { text: `track 1 interface GigabitEthernet0/1 line-protocol`, tags: ['HSRP'] },
        { text: `!` },
        { text: `interface GigabitEthernet0/0.10`, tags: ['HSRP', 'DHCP'] },
        { text: ` description Core Datacenter / SRV-DHCP`, tags: ['DHCP'] },
        { text: ` encapsulation dot1Q 10`, tags: ['HSRP'] },
        { text: ` ip address ${p}.10.2 255.255.255.0`, tags: ['HSRP'] },
        { text: ` standby version 2`, tags: ['HSRP'] },
        { text: ` standby 1 ip ${p}.10.1`, tags: ['HSRP'] },
        { text: ` standby 1 timers msec 250 msec 750`, tags: ['HSRP'] },
        { text: ` standby 1 priority 110`, tags: ['HSRP'] },
        { text: ` standby 1 preempt`, tags: ['HSRP'] },
        { text: ` standby 1 track 1 decrement 20`, tags: ['HSRP'] },
        { text: `!` },
        { text: `interface GigabitEthernet0/1`, tags: ['NAT', 'MPLS'] },
        { text: ` description Salida WAN / ISP & PE-01`, tags: ['NAT'] },
        { text: ` ip address 200.14.80.10 255.255.255.248`, tags: ['NAT'] },
        { text: ` ip nat outside`, tags: ['NAT'] },
        { text: `!` },
        { text: `ip nat inside source static ${p}.10.80 200.14.80.12`, tags: ['NAT'] },
        { text: `ip nat pool POOL-CGNAT-RFC6598 100.64.0.1 100.64.0.64 netmask 255.255.255.0`, tags: ['NAT'] },
        { text: `ip nat inside source list ACL-SEDES interface GigabitEthernet0/1 overload`, tags: ['NAT'] },
        { text: `!` },
        { text: `crypto isakmp policy 10`, tags: ['VPN'] },
        { text: ` encr aes 256`, tags: ['VPN'] },
        { text: ` hash sha256`, tags: ['VPN'] },
        { text: `crypto ipsec transform-set TS-NGN esp-aes 256 esp-sha256-hmac`, tags: ['VPN'] },
        { text: `interface Tunnel100`, tags: ['VPN'] },
        { text: ` description Tunel GRE/IPsec hacia ${sedeC.city}`, tags: ['VPN'] },
        { text: ` ip address 172.30.100.1 255.255.255.252`, tags: ['VPN'] },
        { text: ` ip mtu 1400`, tags: ['VPN'] },
        { text: ` ip tcp adjust-mss 1360`, tags: ['VPN'] },
        { text: ` tunnel source 200.14.80.10`, tags: ['VPN'] },
        { text: ` tunnel destination 190.85.44.22`, tags: ['VPN'] },
        { text: ` tunnel protection ipsec profile PROF-NGN`, tags: ['VPN'] },
      ]),
    },
    {
      id: 'ref-borde-b',
      hostname: 'R-BORDE-B (Standby HSRP)',
      roleLabel: 'Datacenter Principal · Borde Respaldo',
      group: 'reference',
      technology: 'core',
      lines: tagLines([
        { text: `! Router de Borde Secundario Datacenter` },
        { text: `hostname R-BORDE-B` },
        { text: `interface GigabitEthernet0/0.10`, tags: ['HSRP'] },
        { text: ` encapsulation dot1Q 10`, tags: ['HSRP'] },
        { text: ` ip address ${p}.10.3 255.255.255.0`, tags: ['HSRP'] },
        { text: ` standby version 2`, tags: ['HSRP'] },
        { text: ` standby 1 ip ${p}.10.1`, tags: ['HSRP'] },
        { text: ` standby 1 timers msec 250 msec 750`, tags: ['HSRP'] },
        { text: ` standby 1 priority 100`, tags: ['HSRP'] },
        { text: ` standby 1 preempt`, tags: ['HSRP'] },
        { text: `!` },
        { text: `router ospf 10`, tags: ['MPLS'] },
        { text: ` router-id 10.255.0.2`, tags: ['MPLS'] },
        { text: ` network ${p}.10.0 0.0.0.255 area 0`, tags: ['MPLS'] },
      ]),
    },
    {
      id: 'ref-pe-mpls',
      hostname: 'PE-01 (MPLS L3VPN + DiffServ-TE + FRR)',
      roleLabel: 'Núcleo Proveedor · Provider Edge',
      group: 'reference',
      technology: 'mpls',
      lines: tagLines([
        { text: `! Provider Edge MPLS Carrier (DiffServ-TE + FRR)` },
        { text: `hostname PE-01` },
        { text: `ip vrf VRF-NGN-CORP`, tags: ['MPLS'] },
        { text: ` rd 65100:101`, tags: ['MPLS'] },
        { text: ` route-target export 65100:101`, tags: ['MPLS'] },
        { text: ` route-target import 65100:101`, tags: ['MPLS'] },
        { text: `!` },
        { text: `mpls label protocol ldp`, tags: ['MPLS'] },
        { text: `mpls traffic-eng tunnels`, tags: ['MPLS'] },
        { text: `mpls traffic-eng ds-te mode ietf`, tags: ['MPLS', 'QoS'] },
        { text: `!` },
        { text: `interface GigabitEthernet0/0`, tags: ['MPLS', 'QoS'] },
        { text: ` description Troncal hacia P-01 (Core OSPF + TE-FRR)`, tags: ['MPLS'] },
        { text: ` ip address 10.254.1.1 255.255.255.252`, tags: ['MPLS'] },
        { text: ` ip ospf fast-reroute per-prefix enable`, tags: ['MPLS'] },
        { text: ` mpls ip`, tags: ['MPLS'] },
        { text: ` mpls traffic-eng tunnels`, tags: ['MPLS'] },
        { text: ` mpls traffic-eng backup-path Tunnel50`, tags: ['MPLS'] },
        { text: `!` },
        { text: `interface GigabitEthernet0/2`, tags: ['MPLS', 'QoS'] },
        { text: ` description Acceso CE ${sedeA.city}`, tags: ['MPLS'] },
        { text: ` ip vrf forwarding VRF-NGN-CORP`, tags: ['MPLS'] },
        { text: ` ip address 172.16.${sedeA.subnetOctet}.1 255.255.255.252`, tags: ['MPLS'] },
        { text: ` service-policy output PM-CORE-MPLS-EXP`, tags: ['QoS', 'MPLS'] },
        { text: `!` },
        { text: `router bgp 65100`, tags: ['MPLS'] },
        { text: ` neighbor 10.255.255.2 remote-as 65100`, tags: ['MPLS'] },
        { text: ` neighbor 10.255.255.2 update-source Loopback0`, tags: ['MPLS'] },
        { text: ` address-family vpnv4`, tags: ['MPLS'] },
        { text: `  neighbor 10.255.255.2 activate`, tags: ['MPLS'] },
        { text: `  neighbor 10.255.255.2 send-community extended`, tags: ['MPLS'] },
      ]),
    },
    {
      id: 'ref-sede-b-ppp',
      hostname: `R-SEDE-B (${sedeB.city} · PPP CHAP / QoS)`,
      roleLabel: 'Sede B · Enlace Serial & QoS DiffServ',
      group: 'reference',
      technology: 'mpls',
      lines: tagLines([
        { text: `! Sede B (${sedeB.name}) - Serial PPP CHAP + DiffServ` },
        { text: `hostname R-SEDE-B` },
        { text: `username R-BORDE-A password 0 ngn2026`, tags: ['PPP'] },
        { text: `!` },
        { text: `interface Serial0/0/0`, tags: ['PPP', 'QoS'] },
        { text: ` description Enlace WAN Serial hacia Nucleo`, tags: ['PPP'] },
        { text: ` ip address 172.16.${sedeB.subnetOctet}.2 255.255.255.252`, tags: ['PPP'] },
        { text: ` encapsulation ppp`, tags: ['PPP'] },
        { text: ` ppp authentication chap`, tags: ['PPP'] },
        { text: ` service-policy output PM-WAN-DIFFSERV`, tags: ['QoS'] },
        { text: `!` },
        { text: `policy-map PM-WAN-DIFFSERV`, tags: ['QoS'] },
        { text: ` class CM-VOZ-EF`, tags: ['QoS'] },
        { text: `  priority percent 30`, tags: ['QoS'] },
        { text: ` class CM-VIDEO-AF41`, tags: ['QoS'] },
        { text: `  bandwidth percent 35`, tags: ['QoS'] },
        { text: `  random-detect dscp-based`, tags: ['QoS'] },
        { text: ` class CM-ERP-AF21`, tags: ['QoS'] },
        { text: `  bandwidth percent 20`, tags: ['QoS'] },
        { text: `  random-detect`, tags: ['QoS'] },
      ]),
    },
    {
      id: 'ref-olt-gpon',
      hostname: `OLT-01 + R-SEDE-C (${sedeC.city} · GPON PPPoE / IPv6-PD)`,
      roleLabel: 'Acceso Óptico Pasivo & Túnel IPsec',
      group: 'reference',
      technology: 'gpon',
      lines: tagLines([
        { text: `! OLT GPON + Router Sede C (${sedeC.name})` },
        { text: `interface gpon-olt_1/1/1`, tags: ['PPP'] },
        { text: ` description Splitter Optico ${sedeC.splitterRatio || '1:32'} Clase ${sedeC.gponOpticalClass || 'B+'} hacia ${sedeC.city}`, tags: ['PPP'] },
        { text: ` onu 12 type ZTE-F660 sn ZTEG94C18A02`, tags: ['PPP'] },
        { text: ` gemport 101 unicast tcont 1`, tags: ['PPP', 'QoS'] },
        { text: ` tcont 1 profile TCONT-EF-VOZ`, tags: ['QoS'] },
        { text: `!` },
        { text: `interface Dialer1`, tags: ['PPP'] },
        { text: ` mtu 1492`, tags: ['PPP'] },
        { text: ` encapsulation ppp`, tags: ['PPP'] },
        { text: ` pppoe-client dial-pool-number 1`, tags: ['PPP'] },
        { text: ` ipv6 dhcp client pd POOL-PD-56`, tags: ['DHCP'] },
        { text: ` ip tcp adjust-mss 1452`, tags: ['PPP'] },
        { text: `!` },
        { text: `interface Tunnel0`, tags: ['VPN', 'DHCP'] },
        { text: ` ip address 172.30.100.2 255.255.255.252`, tags: ['VPN'] },
        { text: ` ip mtu 1400`, tags: ['VPN'] },
        { text: ` ip tcp adjust-mss 1360`, tags: ['VPN'] },
        { text: ` tunnel protection ipsec profile PROF-NGN`, tags: ['VPN'] },
        { text: `!` },
        { text: `interface GigabitEthernet0/0.${sedeC.vlanBase}`, tags: ['DHCP'] },
        { text: ` ip helper-address ${p}.10.10`, tags: ['DHCP'] },
      ]),
    },
  ];

  return [...devices, ...design.sites.map((s) => generateSiteRouterCli(s, design))];
}

export function buildFullExportBundle(
  design: InfraDesign,
  sedeA: SiteNode,
  sedeB: SiteNode,
  sedeC: SiteNode
): string {
  const configs = generateReferenceConfigs(design, sedeA, sedeB, sedeC);
  const vlsm = calculateDesignVlsm(design);
  const cgnat = calculateCgnatOffload(design);

  const lines: string[] = [
    `================================================================================`,
    `PAQUETE COMPLETO DE INGENIERÍA ISP - ${design.orgName.toUpperCase()}`,
    `Plantilla: ${design.summaryTag} | Red IPv4: ${design.baseNetworkPrefix}.0.0/16 | IPv6: ${design.policies.ipv6IspPrefix}`,
    `Adopción IPv6: ${cgnat.ipv6OffloadPct}% | Pool CGNAT: ${cgnat.cgnatPoolCidr} (IPs públicas requeridas: ${cgnat.publicIpsWithIpv6}, ahorradas: ${cgnat.publicIpsSaved})`,
    `================================================================================`,
    ``,
    `1. TABLA DE DIRECCIONAMIENTO VLSM & DUAL-STACK IPv6`,
    `--------------------------------------------------------------------------------`,
    `SEDE | VLAN | RED IPv4 | MÁSCARA | GATEWAY | RANGO DHCP | PREFIJO IPv6`,
    ...vlsm.map(
      (r) =>
        `${r.siteName} | VLAN ${r.vlanId} (${r.vlanName}) | ${r.network}/${r.cidr} | ${r.mask} | ${r.gateway} | ${r.dhcpRange} | ${r.ipv6Prefix} [${r.ipv6Type}]`
    ),
    ``,
    `2. CONFIGURACIONES CLI DE EQUIPOS (${configs.length} dispositivos)`,
    `--------------------------------------------------------------------------------`,
  ];

  configs.forEach((cfg) => {
    lines.push(``);
    lines.push(`>>> DISPOSITIVO: ${cfg.hostname} (${cfg.roleLabel}) <<<`);
    cfg.lines.forEach((l) => lines.push(l.text));
  });

  return lines.join('\n');
}
