/*
 * pIRC - Cliente de IRC.
 * Copyright (C) 2002 - Ademir Constantino Filho
 * Licensed under the GNU General Public License, version 2 or later.
 */

/**
 * The servers list, grouped by network. Port of Server.java and
 * PIRCServersReader.java: the list is kept in the browser localStorage
 * instead of cfg/servers.xml.
 */
export interface Server {
  /** network, used to group the servers in the Conexão window */
  group: string;
  /** name shown in the list */
  name: string;
  /** server address */
  host: string;
  port: number;
  /** connect with SSL/TLS (usually port 6697) */
  tls?: boolean;
}

const STORAGE_KEY = 'pirc.servers';

/** cfg/servers.xml of pIRC, plus networks that are online today */
export const DEFAULT_SERVERS: readonly Server[] = [
  { group: 'brasnet', name: 'Sercomtel', host: 'irc.sercomtel.com.br', port: 6667 },
  { group: 'brasnet', name: 'Elogica-Refice/PE', host: 'Elogica.REC.PE.Brasnet.org', port: 6667 },
  { group: 'brasnet', name: 'Samnet-Natal/RN', host: 'Samnet.NAT.RN.Brasnet.org', port: 6667 },
  { group: 'brasnet', name: 'brasirc.com.br', host: 'irc.brasirc.com.br', port: 6667 },
  { group: 'libera', name: 'Libera.Chat', host: 'irc.libera.chat', port: 6697, tls: true },
  { group: 'oftc', name: 'OFTC', host: 'irc.oftc.net', port: 6697, tls: true },
];

export function sameServer(a: Server, b: Server): boolean {
  return a.group === b.group && a.name === b.name && a.host === b.host && a.port === b.port;
}

export function loadServers(): Server[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const servers = JSON.parse(saved) as Server[];
      if (Array.isArray(servers)) {
        return servers;
      }
    }
  } catch {
    /* storage unavailable or invalid, use the default list */
  }
  return [...DEFAULT_SERVERS];
}

export function saveServers(servers: readonly Server[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
  } catch {
    /* storage unavailable, the list is kept only while the page is open */
  }
}

/** @return the groups (networks) of the servers, in the order they appear */
export function getGroups(servers: readonly Server[]): string[] {
  return [...new Set(servers.map((s) => s.group))];
}
