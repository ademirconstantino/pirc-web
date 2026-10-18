/*
 * pIRC - Cliente de IRC.
 * Copyright (C) 2002 - Ademir Constantino Filho
 * Licensed under the GNU General Public License, version 2 or later.
 */

/**
 * The nicknames contained in a channel. The nicknames keep their status
 * prefix (@ for operators, + for voice). Port of NickNameList.java; the
 * functions return new arrays so they can be kept in React state.
 * @author Ademir Constantino Filho
 */
export type NickList = readonly string[];

function getStatus(nick: string): string {
  return nick.startsWith('@') || nick.startsWith('+') ? nick.substring(0, 1) : '';
}

function statusOrder(nick: string): number {
  switch (getStatus(nick)) {
    case '@':
      return 0;
    case '+':
      return 1;
    default:
      return 2;
  }
}

/** Removes the status (@ or +) from the nickname */
export function stripStatus(nick: string): string {
  return nick.substring(getStatus(nick).length);
}

/** Returns the index of a nickname, ignoring the status (@ or +) and the case */
export function indexOfNick(list: NickList, nick: string): number {
  const clean = stripStatus(nick).toLowerCase();
  return list.findIndex((n) => stripStatus(n).toLowerCase() === clean);
}

export function containsNick(list: NickList, nick: string): boolean {
  return indexOfNick(list, nick) > -1;
}

/**
 * Organize all nicknames by status, keeping the order inside each status:
 * 1. Operator; 2. Voice; 3. Normal user
 */
export function organizeByStatus(list: NickList): NickList {
  /* Array.prototype.sort is stable */
  return [...list].sort((a, b) => statusOrder(a) - statusOrder(b));
}

export function addNick(list: NickList, nick: string): NickList {
  return containsNick(list, nick) ? list : organizeByStatus([...list, nick]);
}

export function removeNick(list: NickList, nick: string): NickList {
  const index = indexOfNick(list, nick);
  return index === -1 ? list : list.filter((_, i) => i !== index);
}

/** Replace a nickname, keeping its status */
export function updateNick(list: NickList, oldNick: string, newNick: string): NickList {
  const index = indexOfNick(list, oldNick);
  if (index === -1) {
    return list;
  }
  const status = getStatus(list[index]);
  return organizeByStatus([...list.filter((_, i) => i !== index), status + newNick]);
}
