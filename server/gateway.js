/*
 * pIRC - Cliente de IRC.
 * Copyright (C) 2026 - Ademir Constantino
 * Licensed under the GNU General Public License, version 2 or later.
 */

/**
 * pIRC gateway: browsers can not open TCP connections, so the web client
 * talks to this server over a WebSocket and the gateway opens the
 * connection with the IRC server. Port of IRCSocket.java: the lines are
 * sent in UTF-8 and read in UTF-8, falling back to ISO-8859-1 for lines
 * that are not valid UTF-8.
 *
 * Protocol (JSON messages over the WebSocket at /irc):
 *   browser -> gateway  {type:"connect", host, port, tls}  {type:"line", line}
 *   gateway -> browser  {type:"connected"}  {type:"line", line}
 *                       {type:"error", message}  {type:"closed"}
 *
 * Environment:
 *   PIRC_GATEWAY_PORT   port to listen on (8667)
 *   PIRC_GATEWAY_HOST   address to listen on (127.0.0.1)
 *   PIRC_ALLOWED_PORTS  IRC ports the gateway connects to (6660-6699,7000)
 *   PIRC_ALLOWED_HOSTS  comma separated IRC hosts, empty allows any host
 *   PIRC_ALLOWED_ORIGINS comma separated page origins, empty allows any origin
 *
 * Usage: node server/gateway.js [--static dist]
 */

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PIRC_GATEWAY_PORT ?? 8667);
const HOST = process.env.PIRC_GATEWAY_HOST ?? '127.0.0.1';
const CONNECT_TIMEOUT = 20_000;
/* RFC 2812 lines have 512 bytes, IRCv3 tags can make them longer */
const MAX_LINE = 16 * 1024;

const allowedPorts = parsePorts(process.env.PIRC_ALLOWED_PORTS ?? '6660-6699,7000');
const allowedHosts = parseList(process.env.PIRC_ALLOWED_HOSTS).map((h) => h.toLowerCase());
const allowedOrigins = parseList(process.env.PIRC_ALLOWED_ORIGINS);

const staticIndex = process.argv.indexOf('--static');
const staticDir = staticIndex > -1 ? path.resolve(process.argv[staticIndex + 1] ?? 'dist') : null;

function parseList(value) {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function parsePorts(value) {
  const ranges = parseList(value).map((part) => {
    const [from, to] = part.split('-').map(Number);
    return [from, to ?? from];
  });
  return (port) => ranges.some(([from, to]) => port >= from && port <= to);
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
const latin1 = new TextDecoder('latin1');

/** Decodes a line in UTF-8, or in ISO-8859-1 if it is not valid UTF-8 */
function decode(bytes) {
  try {
    return utf8.decode(bytes);
  } catch {
    return latin1.decode(bytes);
  }
}

/* ---------------------------------------------------------- static files */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function serveStatic(req, res) {
  if (!staticDir) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('pIRC gateway: use the WebSocket at /irc\n');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = path.join(staticDir, path.normalize(decodeURIComponent(url.pathname)));
  if (!file.startsWith(staticDir)) {
    res.writeHead(403).end();
    return;
  }
  let stat;
  try {
    stat = statSync(file);
    if (stat.isDirectory()) {
      file = path.join(file, 'index.html');
      stat = statSync(file);
    }
  } catch {
    /* single page application */
    file = path.join(staticDir, 'index.html');
    try {
      stat = statSync(file);
    } catch {
      res.writeHead(404).end();
      return;
    }
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Content-Length': stat.size,
  });
  createReadStream(file).pipe(res);
}

/* ------------------------------------------------------------- IRC bridge */

function bridge(ws, req) {
  const peer = req.socket.remoteAddress;
  /** @type {net.Socket | null} */
  let irc = null;
  let pending = Buffer.alloc(0);

  const emit = (message) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const closeAll = () => {
    if (irc) {
      irc.destroy();
      irc = null;
    }
    if (ws.readyState === ws.OPEN) {
      emit({ type: 'closed' });
      ws.close();
    }
  };

  const onData = (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    let index;
    while ((index = pending.indexOf(0x0a)) > -1) {
      let end = index;
      if (end > 0 && pending[end - 1] === 0x0d) {
        end--;
      }
      const line = decode(pending.subarray(0, end));
      pending = pending.subarray(index + 1);
      if (line !== '') {
        emit({ type: 'line', line });
      }
    }
    if (pending.length > MAX_LINE) {
      pending = Buffer.alloc(0);
    }
  };

  const connect = ({ host, port, tls: useTls }) => {
    host = String(host ?? '').trim();
    port = Number(port);
    if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
      emit({ type: 'error', message: 'Servidor inválido' });
      return closeAll();
    }
    if (!allowedPorts(port)) {
      emit({ type: 'error', message: `A porta ${port} não é permitida pelo gateway` });
      return closeAll();
    }
    if (allowedHosts.length > 0 && !allowedHosts.includes(host.toLowerCase())) {
      emit({ type: 'error', message: `O servidor ${host} não é permitido pelo gateway` });
      return closeAll();
    }
    console.log(`[gateway] ${peer} -> ${host}:${port}${useTls ? ' (tls)' : ''}`);
    const socket = useTls
      ? tls.connect({ host, port, servername: net.isIP(host) ? undefined : host })
      : net.connect({ host, port });
    irc = socket;
    socket.setTimeout(CONNECT_TIMEOUT);
    socket.once(useTls ? 'secureConnect' : 'connect', () => {
      socket.setTimeout(0);
      socket.setKeepAlive(true, 60_000);
      emit({ type: 'connected' });
    });
    socket.on('timeout', () => {
      emit({ type: 'error', message: `Tempo esgotado conectando a ${host}:${port}` });
      closeAll();
    });
    socket.on('data', onData);
    socket.on('error', (e) => {
      emit({ type: 'error', message: e.message });
    });
    socket.on('close', () => {
      if (irc === socket) {
        irc = null;
        closeAll();
      }
    });
  };

  ws.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    if (message.type === 'connect' && !irc) {
      connect(message);
    } else if (message.type === 'line' && irc && typeof message.line === 'string') {
      /* one line per message, the browser can not inject other commands */
      const line = message.line.replace(/[\r\n]/g, '').slice(0, MAX_LINE);
      irc.write(`${line}\r\n`, 'utf8');
    }
  });
  ws.on('close', closeAll);
  ws.on('error', closeAll);
}

/* ------------------------------------------------------------------ main */

const server = createServer(serveStatic);
const wss = new WebSocketServer({
  server,
  path: '/irc',
  verifyClient: ({ origin }) => allowedOrigins.length === 0 || allowedOrigins.includes(origin),
});
wss.on('connection', bridge);

server.listen(PORT, HOST, () => {
  console.log(`[gateway] pIRC gateway on http://${HOST}:${PORT} (WebSocket /irc)`);
  if (staticDir) {
    console.log(`[gateway] serving ${staticDir}`);
  }
});
