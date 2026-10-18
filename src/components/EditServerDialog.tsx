import { FormEvent, useState } from 'react';
import type { Server } from '../servers';
import Dialog from './Dialog';

interface EditServerDialogProps {
  /** the server to edit or null to add a new server */
  server: Server | null;
  groups: string[];
  onSave: (server: Server) => void;
  onClose: () => void;
}

/** Dialog to add or edit a server of the servers list, port of PIRCEditServer.java */
export default function EditServerDialog({ server, groups, onSave, onClose }: EditServerDialogProps) {
  const [name, setName] = useState(server?.name ?? '');
  const [host, setHost] = useState(server?.host ?? '');
  const [port, setPort] = useState(String(server?.port ?? 6667));
  const [group, setGroup] = useState(server?.group ?? groups[0] ?? '');
  const [useTls, setUseTls] = useState(server?.tls ?? false);
  const [warning, setWarning] = useState('');

  const ok = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() === '' || host.trim() === '' || group.trim() === '') {
      setWarning('Preencha todos os campos.');
      return;
    }
    const portValue = /^\d+$/.test(port.trim()) ? Number(port.trim()) : -1;
    if (portValue <= 0 || portValue > 65535) {
      setWarning('Porta inválida.');
      return;
    }
    onSave({ group: group.trim(), name: name.trim(), host: host.trim(), port: portValue, tls: useTls });
  };

  return (
    <Dialog title={server ? `Editar ${server.name}` : 'Adicionar Servidor'} width={360} onClose={onClose}>
      <form onSubmit={ok}>
        <div className="dialog-body edit-server-form">
          <label htmlFor="srv-name">Nome</label>
          <input id="srv-name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="srv-url">URL</label>
          <input id="srv-url" value={host} onChange={(e) => setHost(e.target.value)} />
          <label htmlFor="srv-port">Porta</label>
          <input
            id="srv-port"
            inputMode="numeric"
            value={port}
            onChange={(e) => {
              setPort(e.target.value);
              if (e.target.value.trim() === '6697') {
                setUseTls(true);
              }
            }}
          />
          <label htmlFor="srv-group">Grupo</label>
          <input id="srv-group" list="srv-groups" value={group} onChange={(e) => setGroup(e.target.value)} />
          <datalist id="srv-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <span />
          <label className="checkbox">
            <input type="checkbox" checked={useTls} onChange={(e) => setUseTls(e.target.checked)} /> SSL/TLS
          </label>
          {warning && <p className="form-warning">{warning}</p>}
        </div>
        <div className="dialog-buttons">
          <button type="submit" className="primary">
            Ok
          </button>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </Dialog>
  );
}
