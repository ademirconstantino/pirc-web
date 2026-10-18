# pIRC Web — Portable IRC

**pirc-web is the web port of [pIRC](https://github.com/ademirconstantino/pirc),
the IRC client written in Java in 2002, now in React and TypeScript.**

pIRC was created by **Ademir Constantino Filho**, with the collaboration of
**João Pedrosa** (mIRC color/style stripping). The web version keeps the
behavior and the look of the Swing client: the *Arquivo* and *DCC* menus, the
*Conexão* window, and one window per channel, private conversation and server
messages inside the main pIRC window. The interface is in Portuguese.

## How it works

Browsers can't open TCP connections, so pirc-web has two parts:

```
 browser (React)  ──WebSocket /irc──▶  gateway (Node)  ──TCP/TLS──▶  IRC server
```

- **`src/`**: the React client. All the IRC logic runs in the browser.
- **`server/gateway.js`**: a small WebSocket→TCP bridge that does what
  `IRCSocket.java` did. It sends lines in UTF-8 and reads them in UTF-8,
  falling back to ISO-8859-1 (Latin-1).

## Requirements

- Node.js 18 or newer

## Development

```sh
npm install
npm run dev        # gateway on :8667 + vite on http://localhost:5173
npm test           # unit tests (vitest)
```

## Production

```sh
npm run build
npm start          # gateway serves dist/ and the WebSocket on http://127.0.0.1:8667
```

To serve it publicly, put the gateway behind a reverse proxy with TLS (the
client uses `wss://` when the page is on `https://`), or set
`PIRC_GATEWAY_HOST=0.0.0.0`. To use a gateway on another address, build with
`VITE_PIRC_GATEWAY=wss://host/irc`.

### Gateway settings

| Variable | Default | Description |
| --- | --- | --- |
| `PIRC_GATEWAY_PORT` | `8667` | Port to listen on |
| `PIRC_GATEWAY_HOST` | `127.0.0.1` | Address to listen on |
| `PIRC_ALLOWED_PORTS` | `6660-6699,7000` | IRC ports the gateway may connect to |
| `PIRC_ALLOWED_HOSTS` | *(any)* | Comma-separated IRC hosts allowed |
| `PIRC_ALLOWED_ORIGINS` | *(any)* | Comma-separated page origins allowed to use the WebSocket |

The gateway connects anywhere the allowed ports permit, so a public deployment
should set `PIRC_ALLOWED_HOSTS` and `PIRC_ALLOWED_ORIGINS`. Otherwise anyone
can use it as a relay.

## Usage

1. Open *Arquivo > Conectar*
2. Fill in the name, e-mail, nickname and alternative nickname
3. Choose the group (network) and the server, and click *Conectar*
4. Type `/join #channel` in the *Main Window*

| Command | Description |
| --- | --- |
| `/join #channel` | Joins a channel |
| `/part #channel` | Leaves the channel (closing its window does the same) |
| `/nick newnick` | Changes your nickname |
| `/msg nick text` | Sends a private message |
| `/me text` | Sends an action (`* nick text`) |
| `/quit [message]` | Disconnects from the server |

Any other command is sent to the server as typed (`/mode`, `/topic`,
`/whois`, ...). Double-click a nickname to open a private window. Up and down
arrows recall the lines you typed.

Windows can be moved, resized, minimized and maximized. The bar at the bottom
lists them and highlights the ones with new messages. On narrow screens each
window fills the screen and the bar works as tabs.

## Servers list

The list starts with the servers from pIRC's `cfg/servers.xml` (brasnet), plus
Libera.Chat and OFTC over TLS. It is kept in the browser's `localStorage`.
Servers can be added, edited and deleted in the *Conexão* window, and a server
can use SSL/TLS (usually port 6697).

## Differences from the Java version

- SSL/TLS connections are supported
- Your own messages show as `<nick> text` (the Java version showed `> text`)
- No ident server (port 113); browsers can't run one
- `PASS pIRC` is no longer sent at registration. Some networks treat PASS as
  an account password.
- The Dean S. Jones icons from the Java version are not included, because
  their license does not allow use in web pages

Not implemented yet, as in the Java version: DCC, the *Opções* dialog, and the
profiles, translations and themes in pIRC's `cfg/`.

## Project structure

```
src/irc/IrcMessage.ts        IRC line parser                 (IrcMessage.java)
src/irc/colorStrip.ts        mIRC colors/styles removal      (ColorStrip.java)
src/irc/nickList.ts          channel nicknames by status     (NickNameList.java)
src/irc/constants.ts         numeric replies                 (ProtocolHandlerConstants.java)
src/irc/IrcClient.ts         connection, commands, protocol  (PIRCFrame + ProtocolHandler)
src/servers.ts               servers list                    (Server + PIRCServersReader)
src/components/Desktop.tsx   windows desktop                 (JDesktopPane)
src/components/ChatView.tsx  chat window                     (ChatWindow, PIRCChannelWindow)
src/components/ConnectionDialog.tsx                          (PIRCConnectionWindow)
src/components/EditServerDialog.tsx                          (PIRCEditServer)
src/components/ErrorDialog.tsx                               (PIRCExceptionWindow)
src/components/MenuBar.tsx                                   (PIRCMenu)
server/gateway.js            WebSocket → IRC bridge          (IRCSocket.java)
public/images/               images from the Java version
```

## License

pIRC is free software, distributed under the terms of the GNU General Public
License, version 2 or (at your option) any later version. See
[`license/GPL-pt_BR.txt`](license/GPL-pt_BR.txt) and
https://www.gnu.org/licenses/old-licenses/gpl-2.0.html.

Copyright (C) 2002 Ademir Constantino Filho
# pirc-web
