/*
 * pIRC - Cliente de IRC.
 * Copyright (C) 2002 - Ademir Constantino Filho
 * Licensed under the GNU General Public License, version 2 or later.
 */

/**
 * A line sent by the IRC server: [':' prefix ' '] command [' ' params]
 * The last parameter may start with ':' and then contains spaces.
 * Port of IrcMessage.java.
 */
export class IrcMessage {
  readonly prefix: string;
  readonly command: string;
  readonly params: readonly string[];

  constructor(prefix: string, command: string, params: string[]) {
    this.prefix = prefix;
    this.command = command;
    this.params = Object.freeze([...params]);
  }

  /**
   * Parses a line sent by the server
   * @param line the line without CRLF
   * @return the message or null if the line has no command
   */
  static parse(line: string): IrcMessage | null {
    let rest = line.trim();
    let prefix = '';
    if (rest.startsWith(':')) {
      const space = rest.indexOf(' ');
      if (space === -1) {
        return null;
      }
      prefix = rest.substring(1, space);
      rest = rest.substring(space + 1).trimStart();
    }
    const params: string[] = [];
    let command: string | null = null;
    while (rest.length > 0) {
      if (command !== null && rest.startsWith(':')) {
        params.push(rest.substring(1));
        break;
      }
      const space = rest.indexOf(' ');
      const token = space === -1 ? rest : rest.substring(0, space);
      if (command === null) {
        command = token.toUpperCase();
      } else {
        params.push(token);
      }
      rest = space === -1 ? '' : rest.substring(space + 1).trimStart();
    }
    return command === null ? null : new IrcMessage(prefix, command, params);
  }

  /** @return the parameter at the index or "" if it does not exist */
  param(index: number): string {
    return index >= 0 && index < this.params.length ? this.params[index] : '';
  }

  /** @return the last parameter (usually the text after " :") or "" */
  trailing(): string {
    return this.params.length === 0 ? '' : this.params[this.params.length - 1];
  }

  /** @return the parameters from the index joined with spaces */
  paramsFrom(index: number): string {
    return index < this.params.length ? this.params.slice(index).join(' ') : '';
  }

  isNumeric(): boolean {
    return /^\d{3}$/.test(this.command);
  }

  /** @return the numeric reply code or -1 if the command is not numeric */
  numeric(): number {
    return this.isNumeric() ? Number.parseInt(this.command, 10) : -1;
  }

  /** @return the nickname of the prefix (nick!user@host) */
  nick(): string {
    return nickOf(this.prefix);
  }

  /** @return the user@host of the prefix (nick!user@host) or "" */
  host(): string {
    return hostOf(this.prefix);
  }
}

export function nickOf(prefix: string): string {
  const index = prefix.indexOf('!');
  return index > -1 ? prefix.substring(0, index) : prefix;
}

export function hostOf(prefix: string): string {
  const index = prefix.indexOf('!');
  return index > -1 ? prefix.substring(index + 1) : '';
}
