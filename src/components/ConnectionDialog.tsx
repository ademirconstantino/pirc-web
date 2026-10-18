import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import type { ConnectParams } from '../irc/IrcClient';
import { getGroups, loadServers, sameServer, saveServers, Server } from '../servers';
import Dialog from './Dialog';
import EditServerDialog from './EditServerDialog';

const ALL_GROUPS = 'all';
const FORM_KEY = 'pirc.connection';

interface Identity {
  realName: string;
  email: string;
  nickname: string;
  alternative: string;
}

const DEFAULT_IDENTITY: Identity = {
  realName: 'pIRC',
  email: 'seunome@seuprovedor.com',
  nickname: 'usuario_pIRC',
  alternative: 'usu_pIRC',
};

function loadIdentity(): Identity & { server?: Server } {
  try {
    const saved = localStorage.getItem(FORM_KEY);
    return saved ? { ...DEFAULT_IDENTITY, ...JSON.parse(saved) } : DEFAULT_IDENTITY;
  } catch {
    return DEFAULT_IDENTITY;
  }
}

interface ConnectionDialogProps {
  onConnect: (params: ConnectParams) => void;
  onClose: () => void;
}

/** The Conexão window, port of PIRCConnectionWindow.java */
export default function ConnectionDialog({ onConnect, onClose }: ConnectionDialogProps) {
  const [initial] = useState(loadIdentity);
  const [identity, setIdentity] = useState<Identity>(initial);
  const [servers, setServers] = useState<Server[]>(loadServers);
  const [group, setGroup] = useState(initial.server?.group ?? ALL_GROUPS);
  const groups = useMemo(() => getGroups(servers), [servers]);
  const shown = useMemo(
    () => servers.filter((s) => group === ALL_GROUPS || s.group === group),
    [servers, group],
  );
  const [serverIndex, setServerIndex] = useState(() => {
    const index = initial.server ? shown.findIndex((s) => sameServer(s, initial.server!)) : -1;
    return Math.max(index, 0);
  });
  const [editing, setEditing] = useState<{ server: Server | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [warning, setWarning] = useState('');

  const server: Server | undefined = shown[serverIndex];

  const field = (key: keyof Identity) => ({
    value: identity[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setIdentity({ ...identity, [key]: e.target.value }),
  });

  /** Updates the list and selects a server, as reloadServers(selected) */
  const updateServers = (list: Server[], selected: Server | null) => {
    saveServers(list);
    setServers(list);
    const newGroup = selected && group !== ALL_GROUPS ? selected.group : group;
    setGroup(newGroup);
    const visible = list.filter((s) => newGroup === ALL_GROUPS || s.group === newGroup);
    setServerIndex(Math.max(selected ? visible.findIndex((s) => sameServer(s, selected)) : 0, 0));
  };

  const saveServer = (saved: Server) => {
    const old = editing?.server;
    const list = old ? servers.map((s) => (sameServer(s, old) ? saved : s)) : [...servers, saved];
    setEditing(null);
    updateServers(list, saved);
  };

  const deleteServer = () => {
    setConfirmDelete(false);
    if (server) {
      updateServers(
        servers.filter((s) => !sameServer(s, server)),
        null,
      );
    }
  };

  const connect = (e: FormEvent) => {
    e.preventDefault();
    if (!server) {
      setWarning('Selecione um servidor.');
      return;
    }
    if (identity.nickname.trim() === '') {
      setWarning('Informe o NickName.');
      return;
    }
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({ ...identity, server }));
    } catch {
      /* storage unavailable */
    }
    onConnect({ ...identity, server });
  };

  return (
    <>
      <Dialog title="Conexão" banner="images/connection_top.gif" onClose={onClose}>
        <form onSubmit={connect}>
          <div className="dialog-body connection-form">
            <label htmlFor="con-name">Name:</label>
            <input id="con-name" {...field('realName')} />
            <label htmlFor="con-email">Email:</label>
            <input id="con-email" {...field('email')} />
            <label htmlFor="con-nick">NickName:</label>
            <input id="con-nick" {...field('nickname')} />
            <label htmlFor="con-alt">Alternativo:</label>
            <input id="con-alt" {...field('alternative')} />

            <fieldset className="server-box">
              <legend>Servidor</legend>
              <label htmlFor="con-group">Grupo</label>
              <select
                id="con-group"
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  setServerIndex(0);
                }}
              >
                <option value={ALL_GROUPS}>all</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <label htmlFor="con-server">Servidor</label>
              <select
                id="con-server"
                value={server ? serverIndex : ''}
                onChange={(e) => setServerIndex(Number(e.target.value))}
              >
                {shown.map((s, i) => (
                  <option key={`${s.group}/${s.name}/${s.host}/${s.port}`} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="server-buttons">
                <button type="button" disabled={!server} onClick={() => server && setEditing({ server })}>
                  Editar
                </button>
                <button type="button" onClick={() => setEditing({ server: null })}>
                  Adicionar
                </button>
                <button type="button" disabled={!server} onClick={() => setConfirmDelete(true)}>
                  Deletar
                </button>
              </div>
              {server && (
                <p className="server-address">
                  {server.host}:{server.port}
                  {server.tls ? ' · SSL' : ''}
                </p>
              )}
            </fieldset>
          </div>
          <div className="dialog-buttons">
            <button type="submit" className="primary">
              Conectar
            </button>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </Dialog>

      {editing && (
        <EditServerDialog
          server={editing.server}
          groups={groups}
          onSave={saveServer}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && server && (
        <Dialog title="Deletar" width={340} onClose={() => setConfirmDelete(false)}>
          <p className="dialog-message">Deletar o servidor {server.name}?</p>
          <div className="dialog-buttons">
            <button type="button" className="primary" onClick={deleteServer}>
              Sim
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Não
            </button>
          </div>
        </Dialog>
      )}

      {warning && (
        <Dialog title="Conexão" width={340} onClose={() => setWarning('')}>
          <p className="dialog-message">{warning}</p>
          <div className="dialog-buttons">
            <button type="button" className="primary" onClick={() => setWarning('')}>
              OK
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
