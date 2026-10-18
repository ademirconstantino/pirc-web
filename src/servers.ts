/*
 * pIRC - Cliente de IRC.
 * Copyright (C) 2026 - Ademir Constantino
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

/* the version changes when the default list changes, so the browsers
   that saved the old list get the new one */
const STORAGE_KEY = 'pirc.servers.v2';

/**
 * brasirc.com.br from cfg/servers.xml of pIRC, plus the IRC networks that
 * are online today. SSL/TLS is used where the network has a valid
 * certificate.
 */
export const DEFAULT_SERVERS: readonly Server[] = [
  { group: 'brasnet', name: 'brasirc.com.br', host: 'irc.brasirc.com.br', port: 6667 },
  { group: 'brasnet', name: 'brasirc.com.br (SSL)', host: 'irc.brasirc.com.br', port: 6697, tls: true },
  { group: 'ptnet', name: 'PTnet', host: 'irc.ptnet.org', port: 6697, tls: true },
  { group: 'libera', name: 'Libera.Chat', host: 'irc.libera.chat', port: 6697, tls: true },
  { group: 'oftc', name: 'OFTC', host: 'irc.oftc.net', port: 6697, tls: true },
  { group: 'efnet', name: 'EFnet', host: 'irc.efnet.org', port: 6667 },
  { group: 'ircnet', name: 'IRCnet (underworld.no)', host: 'irc.underworld.no', port: 6667 },
  { group: 'undernet', name: 'Undernet', host: 'irc.undernet.org', port: 6667 },
  { group: 'dalnet', name: 'DALnet', host: 'irc.dal.net', port: 6697, tls: true },
  { group: 'quakenet', name: 'QuakeNet', host: 'irc.quakenet.org', port: 6667 },
  { group: 'rizon', name: 'Rizon', host: 'irc.rizon.net', port: 6697, tls: true },
  { group: 'esper', name: 'EsperNet', host: 'irc.esper.net', port: 6697, tls: true },
  { group: 'gamesurge', name: 'GameSurge', host: 'irc.gamesurge.net', port: 6667 },
  { group: 'hackint', name: 'hackint', host: 'irc.hackint.org', port: 6697, tls: true },
  { group: 'irchighway', name: 'IRCHighway', host: 'irc.irchighway.net', port: 6667 },
  { group: 'snoonet', name: 'Snoonet', host: 'irc.snoonet.org', port: 6697, tls: true },
  { group: 'swiftirc', name: 'SwiftIRC', host: 'irc.swiftirc.net', port: 6697, tls: true },
  { group: 'ergo', name: 'Ergo', host: 'irc.ergo.chat', port: 6697, tls: true },
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
