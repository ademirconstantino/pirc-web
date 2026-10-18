/*
 * pIRC - Cliente de IRC.
 * Copyright (C) 2002 - Ademir Constantino Filho
 * Licensed under the GNU General Public License, version 2 or later.
 */

import { stripColor } from './colorStrip';
import {
  BOUNCE,
  CREATED,
  END_OF_NAMES,
  ERR_NICK_NAME_IN_USE,
  MY_INFO,
  NAM_REPLY,
  QUIT_MESSAGE,
  TOPIC,
  VERSION,
  WELCOME,
  YOUR_HOST,
} from './constants';
import { hostOf, IrcMessage, nickOf } from './IrcMessage';
import {
  addNick,
  containsNick,
  NickList,
  organizeByStatus,
  removeNick,
  stripStatus,
  updateNick,
} from './nickList';
import type { Server } from '../servers';

/** Lines kept in each window */
const MAX_LINES = 1000;

export const MAIN_WINDOW = 'main';

export type WindowKind = 'main' | 'channel' | 'private';

export type LineKind = 'normal' | 'own' | 'event' | 'notice' | 'action' | 'error';

export interface Line {
  id: number;
  time: string;
  text: string;
  kind: LineKind;
}

export interface ChatWindowState {
  id: string;
  kind: WindowKind;
  /** channel name, nickname or "Main Window" */
  title: string;
  lines: readonly Line[];
  timeStamped: boolean;
  nicks: NickList;
  topic: string;
  unread: boolean;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface ErrorInfo {
  title: string;
  message: string;
}

export interface ClientState {
  status: ConnectionStatus;
  myNick: string;
  server: Server | null;
  /** windows in the order they were opened, the main window first */
  windows: readonly ChatWindowState[];
  activeId: string;
  error: ErrorInfo | null;
}

export interface ConnectParams {
  realName: string;
  email: string;
  nickname: string;
  alternative: string;
  server: Server;
}

/** Messages exchanged with the gateway (server/gateway.js) */
type GatewayEvent =
  | { type: 'connected' }
  | { type: 'line'; line: string }
  | { type: 'error'; message: string }
  | { type: 'closed' };

export function isChannel(name: string): boolean {
  return name.length > 0 && '#&+!'.includes(name.charAt(0));
}

export function windowId(kind: WindowKind, name: string): string {
  return kind === 'main' ? MAIN_WINDOW : `${kind}:${name.toLowerCase()}`;
}

function timeStamp(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

function defaultGatewayUrl(): string {
  const configured = import.meta.env.VITE_PIRC_GATEWAY as string | undefined;
  if (configured) {
    return configured;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/irc`;
}

function newWindow(kind: WindowKind, title: string): ChatWindowState {
  return {
    id: windowId(kind, title),
    kind,
    title,
    lines: [],
    timeStamped: kind !== 'main',
    nicks: [],
    topic: '',
    unread: false,
  };
}

/**
 * The pIRC IRC client: the connection with the server (through the
 * WebSocket gateway) and the state of the windows. Port of PIRCFrame
 * (connection and typed commands) and ProtocolHandler (server lines).
 * The state is immutable, React reads it with useSyncExternalStore.
 */
export class IrcClient {
  private state: ClientState = {
    status: 'disconnected',
    myNick: '',
    server: null,
    windows: [newWindow('main', 'Main Window')],
    activeId: MAIN_WINDOW,
    error: null,
  };
  private readonly listeners = new Set<() => void>();
  private socket: WebSocket | null = null;
  private params: ConnectParams | null = null;
  private registered = false;
  /** NAMES replies being received, by channel */
  private readonly names = new Map<string, string[]>();
  private nextLineId = 1;

  constructor(private readonly gatewayUrl: string = defaultGatewayUrl()) {
    this.append(MAIN_WINDOW, `pIRC ${VERSION} - portable IRC`, 'event');
    this.append(MAIN_WINDOW, 'Abra Arquivo > Conectar e depois digite /join #canal', 'event');
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): ClientState => this.state;

  private setState(update: Partial<ClientState>) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener());
  }

  /* ---------------------------------------------------------------- windows */

  getWindow(id: string): ChatWindowState | undefined {
    return this.state.windows.find((w) => w.id === id);
  }

  private updateWindow(id: string, update: (w: ChatWindowState) => ChatWindowState) {
    this.setState({
      windows: this.state.windows.map((w) => (w.id === id ? update(w) : w)),
    });
  }

  /** Adds a window in front of the other windows, or returns the existing one */
  private openWindow(kind: WindowKind, title: string, activate: boolean): string {
    const id = windowId(kind, title);
    if (!this.getWindow(id)) {
      this.setState({ windows: [...this.state.windows, newWindow(kind, title)] });
    }
    if (activate) {
      this.activate(id);
    }
    return id;
  }

  activate(id: string) {
    if (!this.getWindow(id)) {
      return;
    }
    this.setState({
      activeId: id,
      windows: this.state.windows.map((w) => (w.id === id && w.unread ? { ...w, unread: false } : w)),
    });
  }

  private removeWindow(id: string) {
    if (id === MAIN_WINDOW) {
      return;
    }
    const windows = this.state.windows.filter((w) => w.id !== id);
    this.setState({
      windows,
      activeId: this.state.activeId === id ? windows[windows.length - 1].id : this.state.activeId,
    });
  }

  append(id: string, text: string, kind: LineKind = 'normal') {
    const line: Line = { id: this.nextLineId++, time: timeStamp(), text, kind };
    const active = this.state.activeId === id;
    this.updateWindow(id, (w) => ({
      ...w,
      lines: w.lines.length >= MAX_LINES ? [...w.lines.slice(1 - MAX_LINES), line] : [...w.lines, line],
      unread: w.unread || !active,
    }));
  }

  /** Shows a server message in the main window */
  private status(text: string, kind: LineKind = 'normal') {
    this.append(MAIN_WINDOW, '-', kind);
    this.append(MAIN_WINDOW, text, kind);
  }

  private channelWindow(channel: string): ChatWindowState | undefined {
    return this.getWindow(windowId('channel', channel));
  }

  private privateWindow(nick: string, create: boolean): string | null {
    const id = windowId('private', nick);
    if (this.getWindow(id)) {
      return id;
    }
    return create ? this.openWindow('private', nick, true) : null;
  }

  /** Opens a private window with a nickname, double-click in the nicknames list */
  openPrivate(nick: string) {
    const clean = stripStatus(nick);
    if (clean.toLowerCase() !== this.state.myNick.toLowerCase()) {
      this.privateWindow(clean, true);
    }
  }

  /** Closes a window: leaves the channel or closes the private conversation */
  closeWindow(id: string) {
    const w = this.getWindow(id);
    if (!w || w.kind === 'main') {
      return;
    }
    if (w.kind === 'channel' && this.state.status === 'connected') {
      this.send(`PART ${w.title}`);
    }
    this.removeWindow(id);
  }

  dismissError() {
    this.setState({ error: null });
  }

  /* ------------------------------------------------------------- connection */

  isConnected(): boolean {
    return this.state.status === 'connected';
  }

  /**
   * Connects to the server selected in the connection window.
   * The connection is opened by the gateway, the windows are updated
   * when it is done.
   */
  connect(params: ConnectParams) {
    if (this.state.status !== 'disconnected') {
      return;
    }
    const { server } = params;
    this.params = params;
    this.registered = false;
    this.names.clear();
    this.setState({ status: 'connecting', server, myNick: params.nickname.trim() });
    this.status(`Conectando a ${server.host} (${server.port}${server.tls ? ', SSL' : ''})`);

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.gatewayUrl);
    } catch (e) {
      this.connectionFailed(e instanceof Error ? e.message : String(e));
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'connect', host: server.host, port: server.port, tls: !!server.tls }));
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) {
        return;
      }
      let message: GatewayEvent;
      try {
        message = JSON.parse(String(event.data)) as GatewayEvent;
      } catch {
        return;
      }
      this.onGatewayEvent(message);
    };
    socket.onerror = () => {
      if (this.socket === socket && this.state.status === 'connecting') {
        this.connectionFailed(`Gateway indisponível (${this.gatewayUrl})`);
      }
    };
    socket.onclose = () => {
      if (this.socket === socket) {
        this.onDisconnected();
      }
    };
  }

  private onGatewayEvent(event: GatewayEvent) {
    switch (event.type) {
      case 'connected':
        this.setState({ status: 'connected' });
        this.startUp();
        break;
      case 'line':
        this.handleLine(event.line);
        break;
      case 'error':
        if (this.state.status === 'connecting') {
          this.connectionFailed(event.message);
        } else {
          this.status(event.message, 'error');
        }
        break;
      case 'closed':
        this.onDisconnected();
        break;
    }
  }

  private connectionFailed(message: string) {
    this.status('Não foi possível conectar', 'error');
    this.setState({ error: { title: 'Não foi possível conectar', message } });
    this.onDisconnected(false);
  }

  private startUp() {
    const params = this.params!;
    const nick = params.nickname.trim();
    /* the user name can not have spaces */
    const user = params.realName.trim().replace(/\s+/g, '_') || 'pIRC';
    this.send(`NICK ${nick}`);
    this.send(`USER ${user} 0 * :${params.email}`);
  }

  /** Sends the quit message and closes the connection */
  disconnect() {
    if (this.state.status === 'connected') {
      this.send(`QUIT :${QUIT_MESSAGE}`);
    }
    this.onDisconnected();
  }

  /** Called when the connection with the server is closed */
  private onDisconnected(notify = true) {
    const socket = this.socket;
    if (!socket && this.state.status === 'disconnected') {
      return;
    }
    this.socket = null;
    if (socket && socket.readyState <= WebSocket.OPEN) {
      socket.close();
    }
    const main = this.getWindow(MAIN_WINDOW)!;
    this.setState({ status: 'disconnected', windows: [main], activeId: MAIN_WINDOW });
    if (notify) {
      this.status('Desconectado');
    }
  }

  send(line: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'line', line }));
    }
  }

  /**
   * Sends the text typed by the user in a window.
   * Text starting with "/" is sent as an IRC command (/join #pirc),
   * other text is sent as a message to the target of the window.
   */
  sendInput(id: string, text: string) {
    if (text.trim() === '') {
      return;
    }
    const w = this.getWindow(id);
    if (!w) {
      return;
    }
    if (this.state.status !== 'connected') {
      this.append(id, 'Não conectado', 'error');
      return;
    }
    const target = w.kind === 'main' ? null : w.title;
    const me = this.state.myNick;
    if (text.startsWith('/')) {
      let cmd = text.substring(1);
      let rest = '';
      const space = cmd.indexOf(' ');
      if (space > -1) {
        rest = cmd.substring(space + 1);
        cmd = cmd.substring(0, space);
      }
      cmd = cmd.toUpperCase();
      const restSpace = rest.indexOf(' ');
      if (cmd === 'MSG' && restSpace > -1) {
        const to = rest.substring(0, restSpace);
        const msg = rest.substring(restSpace + 1);
        this.send(`PRIVMSG ${to} :${msg}`);
        this.append(id, `-> *${to}* ${msg}`, 'own');
      } else if (cmd === 'ME' && target !== null) {
        this.send(`PRIVMSG ${target} :\u0001ACTION ${rest}\u0001`);
        this.append(id, `* ${me} ${rest}`, 'action');
      } else if (cmd === 'QUIT') {
        this.send(rest ? `QUIT :${rest}` : `QUIT :${QUIT_MESSAGE}`);
      } else {
        this.send(rest === '' ? cmd : `${cmd} ${rest}`);
      }
    } else if (target !== null) {
      this.send(`PRIVMSG ${target} :${text}`);
      this.append(id, `<${me}> ${text}`, 'own');
    } else {
      this.send(text);
    }
  }

  /* --------------------------------------------------------------- protocol */

  private isMe(nick: string): boolean {
    return nick.toLowerCase() === this.state.myNick.toLowerCase();
  }

  /** Handles a line sent by the server */
  handleLine(line: string) {
    const m = IrcMessage.parse(line);
    if (!m) {
      return;
    }
    try {
      this.handle(m, line);
    } catch (e) {
      console.error('pIRC: error handling', line, e);
    }
  }

  private handle(m: IrcMessage, line: string) {
    switch (m.command) {
      case 'PING':
        this.send(`PONG :${m.trailing()}`);
        this.status('Pong');
        break;
      case 'PRIVMSG': {
        const to = m.param(0);
        const msg = m.trailing();
        if (msg.startsWith('\u0001')) {
          this.onCtcp(to, msg.replace(/\u0001/g, ''), m.nick());
        } else if (isChannel(to)) {
          this.onChanMsg(to, msg, m.nick());
        } else {
          this.onPrivMsg(m.nick(), msg);
        }
        break;
      }
      case 'NOTICE':
        if (m.param(0) === 'AUTH') {
          this.status(stripColor(m.trailing()), 'notice');
        } else {
          this.onNotice(m.param(0), m.trailing(), m.nick());
        }
        break;
      case 'JOIN':
        this.onJoin(m.param(0), m.prefix);
        break;
      case 'PART':
        this.onPart(m.param(0), m.prefix);
        break;
      case 'NICK':
        this.onNick(m.param(0), m.prefix);
        break;
      case 'QUIT':
        this.onQuit(m.prefix, m.trailing());
        break;
      case 'KICK':
        this.onKick(m.param(0), m.param(1), m.nick(), m.param(2));
        break;
      case 'MODE':
        this.onMode(m.param(0), m.paramsFrom(1), m.nick());
        break;
      case 'TOPIC':
        this.onTopicSet(m.nick(), m.param(0), m.trailing());
        break;
      case 'ERROR':
        this.status(stripColor(m.trailing()), 'error');
        break;
      default:
        if (m.isNumeric()) {
          this.handleNumeric(m);
        } else {
          this.status(stripColor(line));
        }
    }
  }

  /** Handles the numeric replies, the first parameter is always my nickname */
  private handleNumeric(m: IrcMessage) {
    switch (m.numeric()) {
      case WELCOME:
        this.registered = true;
        this.setState({ myNick: m.param(0) });
        this.status(stripColor(m.trailing()));
        break;
      case YOUR_HOST:
      case CREATED:
        this.status(stripColor(m.trailing()));
        break;
      case MY_INFO:
      case BOUNCE:
        this.status(stripColor(m.paramsFrom(1)));
        break;
      case ERR_NICK_NAME_IN_USE:
        this.onNickInUse(m.param(1));
        break;
      case NAM_REPLY: {
        /* <me> ( "=" / "*" / "@" ) <channel> :<nicks> */
        const chan = m.param(m.params.length - 2).toLowerCase();
        const nicks = this.names.get(chan) ?? [];
        nicks.push(...m.trailing().split(' ').filter((n) => n !== ''));
        this.names.set(chan, nicks);
        break;
      }
      case END_OF_NAMES: {
        const chan = m.param(1);
        const nicks = this.names.get(chan.toLowerCase());
        this.names.delete(chan.toLowerCase());
        if (nicks) {
          this.onNamReply(nicks, chan);
        }
        break;
      }
      case TOPIC:
        this.onTopic(m.param(1), m.trailing());
        break;
      default:
        /* removes the <me> target and shows the reply */
        this.status(stripColor(m.paramsFrom(1)));
    }
  }

  private onNickInUse(nick: string) {
    const alternative = this.params?.alternative.trim() ?? '';
    if (!this.registered && alternative !== '' && alternative.toLowerCase() !== nick.toLowerCase()) {
      this.status(`${nick} já está em uso, tentando ${alternative}`);
      this.setState({ myNick: alternative });
      this.send(`NICK ${alternative}`);
    } else {
      this.status(`${nick} já está em uso, use /nick <novo nick>`, 'error');
    }
  }

  private onJoin(channel: string, prefix: string) {
    const nick = nickOf(prefix);
    const w = this.channelWindow(channel);
    if (!w) {
      if (this.isMe(nick)) {
        this.openWindow('channel', channel, true);
      }
    } else if (!this.isMe(nick)) {
      this.updateWindow(w.id, (cw) => ({ ...cw, nicks: addNick(cw.nicks, nick) }));
      this.append(w.id, `${nick} (${hostOf(prefix)})  Entrou no ${channel}`, 'event');
    }
  }

  private onPart(channel: string, prefix: string) {
    const nick = nickOf(prefix);
    const w = this.channelWindow(channel);
    if (!w) {
      return;
    }
    if (this.isMe(nick)) {
      this.removeWindow(w.id);
      return;
    }
    this.updateWindow(w.id, (cw) => ({ ...cw, nicks: removeNick(cw.nicks, nick) }));
    this.append(w.id, `${nick} (${hostOf(prefix)})  saiu do ${channel}`, 'event');
  }

  private onNick(newNick: string, prefix: string) {
    const host = hostOf(prefix);
    const oldNick = nickOf(prefix);
    if (this.isMe(oldNick)) {
      this.setState({ myNick: newNick });
      this.status(`Você agora é conhecido como ${newNick}`);
    }
    for (const w of this.state.windows) {
      if (w.kind === 'channel' && containsNick(w.nicks, oldNick)) {
        this.updateWindow(w.id, (cw) => ({ ...cw, nicks: updateNick(cw.nicks, oldNick, newNick) }));
        this.append(w.id, `${oldNick} (${host})  mudou o nick para ${newNick}`, 'event');
      }
    }
    this.renamePrivateWindow(oldNick, newNick);
  }

  /** Updates the private message window when the nickname changes */
  private renamePrivateWindow(oldNick: string, newNick: string) {
    const oldId = windowId('private', oldNick);
    const w = this.getWindow(oldId);
    if (!w) {
      return;
    }
    const newId = windowId('private', newNick);
    this.setState({
      windows: this.state.windows.map((pw) => (pw.id === oldId ? { ...pw, id: newId, title: newNick } : pw)),
      activeId: this.state.activeId === oldId ? newId : this.state.activeId,
    });
    this.append(newId, `${oldNick} mudou o nick para ${newNick}`, 'event');
  }

  private onQuit(prefix: string, reason: string) {
    const host = hostOf(prefix);
    const nick = nickOf(prefix);
    for (const w of this.state.windows) {
      if (w.kind === 'channel' && containsNick(w.nicks, nick)) {
        this.updateWindow(w.id, (cw) => ({ ...cw, nicks: removeNick(cw.nicks, nick) }));
        this.append(w.id, `${nick} (${host})  saiu do IRC (${stripColor(reason)})`, 'event');
      }
    }
    const privateId = this.privateWindow(nick, false);
    if (privateId) {
      this.append(privateId, `${nick} saiu do IRC (${stripColor(reason)})`, 'event');
    }
  }

  private onKick(channel: string, who: string, by: string, reason: string) {
    const w = this.channelWindow(channel);
    if (!w) {
      return;
    }
    if (this.isMe(who)) {
      this.removeWindow(w.id);
      this.status(`Você foi kickado do ${channel} por ${by} (${stripColor(reason)})`, 'error');
    } else {
      this.updateWindow(w.id, (cw) => ({ ...cw, nicks: removeNick(cw.nicks, who) }));
      this.append(w.id, `${who} foi kickado por ${by} (${stripColor(reason)})`, 'event');
    }
  }

  private onMode(target: string, modes: string, by: string) {
    const w = isChannel(target) ? this.channelWindow(target) : undefined;
    if (w) {
      this.append(w.id, `${by} modificou o modo: ${modes}`, 'event');
      /* updates the nicknames status (@ and +) */
      this.send(`NAMES ${target}`);
    } else {
      this.status(`${by} modificou o modo de ${target}: ${modes}`);
    }
  }

  private onNamReply(nicks: string[], chan: string) {
    const w = this.channelWindow(chan);
    if (w) {
      this.updateWindow(w.id, (cw) => ({ ...cw, nicks: organizeByStatus(nicks) }));
    } else {
      this.status(`${chan}: ${nicks.join(' ')}`);
    }
  }

  private onChanMsg(to: string, msg: string, from: string) {
    const w = this.channelWindow(to);
    if (w) {
      this.append(w.id, `<${from}> ${stripColor(msg)}`);
    }
  }

  private onPrivMsg(from: string, msg: string) {
    const id = this.privateWindow(from, true)!;
    this.append(id, `<${from}> ${stripColor(msg)}`);
  }

  private onNotice(to: string, msg: string, from: string) {
    const w = isChannel(to) ? this.channelWindow(to) : undefined;
    this.append(w ? w.id : MAIN_WINDOW, `-${from}- ${stripColor(msg)}`, 'notice');
  }

  private onCtcp(to: string, msg: string, from: string) {
    const space = msg.indexOf(' ');
    const ctcp = (space === -1 ? msg : msg.substring(0, space)).toUpperCase();
    const args = space === -1 ? '' : msg.substring(space + 1).trim();
    switch (ctcp) {
      case 'ACTION': {
        const text = `* ${from} ${stripColor(args)}`;
        if (isChannel(to)) {
          const w = this.channelWindow(to);
          if (w) {
            this.append(w.id, text, 'action');
          }
        } else {
          this.append(this.privateWindow(from, true)!, text, 'action');
        }
        return;
      }
      case 'VERSION':
        this.send(`NOTICE ${from} :\u0001VERSION pIRC ${VERSION} - Web - ${navigator.userAgent}\u0001`);
        break;
      case 'PING':
        this.send(`NOTICE ${from} :\u0001PING ${args}\u0001`);
        break;
      default:
      /* other CTCP requests are only shown */
    }
    this.status(`[${ctcp}] de ${from}`);
  }

  private onTopic(channel: string, topic: string) {
    const w = this.channelWindow(channel);
    if (w) {
      const clean = stripColor(topic);
      this.updateWindow(w.id, (cw) => ({ ...cw, topic: clean }));
      this.append(w.id, `-- Talking in ${w.title} - ${new Date().toLocaleString('pt-BR')}`, 'event');
      this.append(w.id, `${w.title} Topic is "${clean}"`, 'event');
    }
  }

  private onTopicSet(by: string, chan: string, newTopic: string) {
    const w = this.channelWindow(chan);
    if (w) {
      const clean = stripColor(newTopic);
      this.updateWindow(w.id, (cw) => ({ ...cw, topic: clean }));
      this.append(w.id, `${by} Modificou o tópico para: ${clean}`, 'event');
    }
  }
}
