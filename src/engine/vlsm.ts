import { InfraDesign, VlsmSubnetRow } from '../types/network';

function cidrToMask(cidr: number): string {
  const mask = (0xffffffff << (32 - cidr)) >>> 0;
  return [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255,
  ].join('.');
}

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function intToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

function pickPrefixForHosts(requiredHosts: number): number {
  const needed = Math.max(10, Math.ceil(requiredHosts * 1.15) + 3);
  for (let prefix = 29; prefix >= 20; prefix--) {
    const usable = Math.pow(2, 32 - prefix) - 2;
    if (usable >= needed) {
      return prefix;
    }
  }
  return 20;
}

export function calculateDesignVlsm(design: InfraDesign): VlsmSubnetRow[] {
  const rows: VlsmSubnetRow[] = [];
  const [oct1, oct2] = design.baseNetworkPrefix.split('.').map((n) => parseInt(n, 10) || 10);

  // Extract base IPv6 /32 prefix hextets (e.g., "2800:480::/32" -> "2800:480")
  const rawV6 = (design.policies.ipv6IspPrefix || '2800:480::/32').split('/')[0].replace(/::$/, '');
  const v6Parts = rawV6.split(':').filter(Boolean);
  const v6Root = `${v6Parts[0] || '2800'}:${v6Parts[1] || '480'}`;

  design.sites.forEach((site, idx) => {
    const blockThirdOctet = ((site.subnetOctet || (idx + 1) * 10) * 2) % 240;
    let cursor = ipToInt(`${oct1}.${oct2}.${blockThirdOctet}.0`);
    const siteHex = (idx + 1).toString(16).padStart(2, '0');

    const vlans = [
      {
        vlanId: site.vlanBase,
        vlanName: 'Datos y Usuarios',
        hosts: Math.max(20, site.devices),
      },
      {
        vlanId: site.vlanBase + 1,
        vlanName: 'Voz / Telemedicina',
        hosts: Math.max(12, Math.round(site.users * 0.45)),
      },
      {
        vlanId: site.vlanBase + 2,
        vlanName: 'Gestión / Red / OLT',
        hosts: Math.max(8, Math.round(site.devices * 0.08) + 6),
      },
    ];

    const sorted = [...vlans].sort((a, b) => b.hosts - a.hosts);

    sorted.forEach((v, vIdx) => {
      const cidr = pickPrefixForHosts(v.hosts);
      const blockSize = Math.pow(2, 32 - cidr);
      if (cursor % blockSize !== 0) {
        cursor = cursor + (blockSize - (cursor % blockSize));
      }
      const networkIp = intToIp(cursor);
      const gatewayIp = intToIp(cursor + 1);
      const dhcpStart = intToIp(cursor + 10);
      const dhcpEnd = intToIp(cursor + blockSize - 2);
      const broadcastIp = intToIp(cursor + blockSize - 1);
      const usableHosts = blockSize - 2;
      const occupancyPct = Math.min(100, Math.round((v.hosts / usableHosts) * 100));

      let ipv6Prefix = '';
      let ipv6Type = '';
      if (site.technology === 'gpon') {
        ipv6Prefix = `${v6Root}:1${siteHex}${(vIdx + 1).toString(16)}::/56`;
        ipv6Type = 'DHCPv6-PD /56 (FTTH)';
      } else {
        ipv6Prefix = `${v6Root}:0${siteHex}:${vIdx + 1}::/64 (de /48)`;
        ipv6Type = 'Corp. /48 Dual-Stack';
      }

      rows.push({
        siteId: site.id,
        siteName: site.name,
        technology: site.technology,
        vlanId: v.vlanId,
        vlanName: v.vlanName,
        network: networkIp,
        cidr,
        mask: cidrToMask(cidr),
        gateway: gatewayIp,
        dhcpRange: `${dhcpStart} – ${dhcpEnd}`,
        broadcast: broadcastIp,
        usableHosts,
        assignedHosts: v.hosts,
        occupancyPct,
        ipv6Prefix,
        ipv6Type,
      });

      cursor += blockSize;
    });
  });

  return rows;
}

export interface CgnatIpv6Summary {
  totalDevices: number;
  sessionsPerDevice: number;
  baseIpv4Sessions: number;
  ipv6OffloadPct: number;
  remainingIpv4Sessions: number;
  portsPerPublicIp: number;
  publicIpsWithoutIpv6: number;
  publicIpsWithIpv6: number;
  publicIpsSaved: number;
  cgnatPoolCidr: string;
}

export function calculateCgnatOffload(design: InfraDesign): CgnatIpv6Summary {
  const totalDevices = design.sites.reduce((a, s) => a + s.devices, 0);
  const sessionsPerDevice = 45; // Concurrent TCP/UDP NAT states per endpoint
  const baseIpv4Sessions = totalDevices * sessionsPerDevice;
  const ipv6OffloadPct = design.policies.ipv6AdoptionPct ?? 25;
  const remainingIpv4Sessions = Math.round(baseIpv4Sessions * (1 - ipv6OffloadPct / 100));
  const portsPerPublicIp = 64000;
  const ratio = design.policies.cgnatRatio || 32;

  const publicIpsWithoutIpv6 = Math.max(
    4,
    Math.ceil(totalDevices / ratio) + Math.ceil(baseIpv4Sessions / portsPerPublicIp)
  );
  const publicIpsWithIpv6 = Math.max(
    2,
    Math.ceil((totalDevices * (1 - ipv6OffloadPct / 100)) / ratio) +
      Math.ceil(remainingIpv4Sessions / portsPerPublicIp)
  );
  const publicIpsSaved = Math.max(0, publicIpsWithoutIpv6 - publicIpsWithIpv6);

  return {
    totalDevices,
    sessionsPerDevice,
    baseIpv4Sessions,
    ipv6OffloadPct,
    remainingIpv4Sessions,
    portsPerPublicIp,
    publicIpsWithoutIpv6,
    publicIpsWithIpv6,
    publicIpsSaved,
    cgnatPoolCidr: '100.64.0.0/16 (RFC 6598)',
  };
}
