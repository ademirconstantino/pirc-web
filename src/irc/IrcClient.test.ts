import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IrcClient, MAIN_WINDOW, windowId } from './IrcClient';

/** A WebSocket that records the lines sent to the gateway */
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static last: FakeWebSocket;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  onclose?: () => void;

  constructor(readonly url: string) {
    FakeWebSocket.last = this;
  }

  send(data: string) {
    const message = JSON.parse(data);
    if (message.type === 'line') {
      this.sent.push(message.line);
    }
  }

  close() {
    this.readyState = 3;
  }

  /** the gateway connected to the IRC server */
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
    this.emit({ type: 'connected' });
  }

  emit(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  receive(...lines: string[]) {
    lines.forEach((line) => this.emit({ type: 'line', line }));
  }
}

const server = { group: 'test', name: 'Test', host: 'irc.test', port: 6667 };
const chan = windowId('channel', '#pirc');

function connected(): [IrcClient, FakeWebSocket] {
  const client = new IrcClient('ws://gateway/irc');
  client.connect({ realName: 'p IRC', email: 'me@test', nickname: 'me', alternative: 'me_', server });
  const ws = FakeWebSocket.last;
  ws.open();
  ws.receive(':srv 001 me :Welcome to IRC');
  return [client, ws];
}

function texts(client: IrcClient, id: string): string[] {
  return client.getWindow(id)!.lines.map((l) => l.text);
}

describe('IrcClient', () => {
  beforeEach(() => vi.stubGlobal('WebSocket', FakeWebSocket));
  afterEach(() => vi.unstubAllGlobals());

  it('registers with NICK and USER', () => {
    const [client, ws] = connected();
    expect(ws.sent).toEqual(['NICK me', 'USER p_IRC 0 * :me@test']);
    expect(client.getState().status).toBe('connected');
  });

  it('uses the alternative nickname when the nickname is in use', () => {
    const client = new IrcClient('ws://gateway/irc');
    client.connect({ realName: 'pIRC', email: 'e', nickname: 'me', alternative: 'me_', server });
    const ws = FakeWebSocket.last;
    ws.open();
    ws.receive(':srv 433 * me :Nickname is already in use');
    expect(ws.sent).toContain('NICK me_');
    expect(client.getState().myNick).toBe('me_');
  });

  it('answers PING', () => {
    const [, ws] = connected();
    ws.receive('PING :srv');
    expect(ws.sent).toContain('PONG :srv');
  });

  it('opens a channel window and keeps its nicknames', () => {
    const [client, ws] = connected();
    ws.receive(
      ':me!u@h JOIN :#pirc',
      ':srv 332 me #pirc :\u00034pIRC\u0003 topic',
      ':srv 353 me = #pirc :zeca @op +voice',
      ':srv 353 me = #pirc :me',
      ':srv 366 me #pirc :End of /NAMES list.',
    );
    const w = client.getWindow(chan)!;
    expect(w.topic).toBe('pIRC topic');
    expect(w.nicks).toEqual(['@op', '+voice', 'zeca', 'me']);
    expect(client.getState().activeId).toBe(chan);

    ws.receive(':ana!a@h JOIN #pirc', ':zeca!z@h NICK :jose', ':op!o@h QUIT :bye');
    expect(client.getWindow(chan)!.nicks).toEqual(['+voice', 'me', 'ana', 'jose']);
    expect(texts(client, chan)).toContain('ana (a@h)  Entrou no #pirc');
    expect(texts(client, chan)).toContain('op (o@h)  saiu do IRC (bye)');
  });

  it('shows channel messages and sends typed text', () => {
    const [client, ws] = connected();
    ws.receive(':me!u@h JOIN #pirc', ':zeca!z@h PRIVMSG #pirc :\u0002oi\u0002 pessoal');
    expect(texts(client, chan)).toContain('<zeca> oi pessoal');
    client.sendInput(chan, 'olá');
    client.sendInput(chan, '/me acena');
    expect(ws.sent).toContain('PRIVMSG #pirc :olá');
    expect(ws.sent).toContain('PRIVMSG #pirc :\u0001ACTION acena\u0001');
    expect(texts(client, chan)).toContain('* me acena');
  });

  it('opens a private window for private messages and follows nick changes', () => {
    const [client, ws] = connected();
    ws.receive(':zeca!z@h PRIVMSG me :oi');
    expect(texts(client, windowId('private', 'zeca'))).toEqual(['<zeca> oi']);
    ws.receive(':zeca!z@h NICK jose');
    expect(client.getWindow(windowId('private', 'zeca'))).toBeUndefined();
    expect(client.getWindow(windowId('private', 'jose'))!.title).toBe('jose');
  });

  it('closes the channel window when kicked or when leaving', () => {
    const [client, ws] = connected();
    ws.receive(':me!u@h JOIN #pirc', ':op!o@h KICK #pirc me :fora');
    expect(client.getWindow(chan)).toBeUndefined();
    expect(texts(client, MAIN_WINDOW)).toContain('Você foi kickado do #pirc por op (fora)');

    ws.receive(':me!u@h JOIN #pirc');
    client.closeWindow(chan);
    expect(ws.sent).toContain('PART #pirc');
    expect(client.getWindow(chan)).toBeUndefined();
  });

  it('sends commands typed with /', () => {
    const [client, ws] = connected();
    client.sendInput(MAIN_WINDOW, '/join #pirc');
    client.sendInput(MAIN_WINDOW, '/msg zeca oi');
    expect(ws.sent).toContain('JOIN #pirc');
    expect(ws.sent).toContain('PRIVMSG zeca :oi');
  });

  it('closes the windows when disconnected', () => {
    const [client, ws] = connected();
    ws.receive(':me!u@h JOIN #pirc', ':zeca!z@h PRIVMSG me :oi');
    ws.emit({ type: 'closed' });
    expect(client.getState().status).toBe('disconnected');
    expect(client.getState().windows.map((w) => w.id)).toEqual([MAIN_WINDOW]);
  });

  it('shows an error when the gateway can not connect', () => {
    const client = new IrcClient('ws://gateway/irc');
    client.connect({ realName: 'pIRC', email: 'e', nickname: 'me', alternative: '', server });
    FakeWebSocket.last.emit({ type: 'error', message: 'connect ECONNREFUSED' });
    expect(client.getState().status).toBe('disconnected');
    expect(client.getState().error?.message).toBe('connect ECONNREFUSED');
  });
});
