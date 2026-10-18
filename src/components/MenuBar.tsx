import { useEffect, useRef, useState } from 'react';
import { useIrcClient, useIrcState } from '../useIrc';

interface MenuItem {
  label: string;
  action?: () => void;
  /** not implemented yet, as in the Swing version */
  disabled?: boolean;
}

interface MenuBarProps {
  onConnect: () => void;
  onAbout: () => void;
}

/** The pIRC menus, port of PIRCMenu.java */
export default function MenuBar({ onConnect, onAbout }: MenuBarProps) {
  const client = useIrcClient();
  const { status, myNick, server } = useIrcState();
  const [open, setOpen] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !barRef.current?.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const menus: Record<string, MenuItem[]> = {
    Arquivo: [
      status === 'disconnected'
        ? { label: 'Conectar', action: onConnect }
        : { label: 'Desconectar', action: () => client.disconnect() },
      { label: 'Opções', disabled: true },
      { label: 'Sobre o pIRC', action: onAbout },
    ],
    DCC: [
      { label: 'Enviar', disabled: true },
      { label: 'Chat', disabled: true },
      { label: 'Opções de DCC', disabled: true },
    ],
  };

  const statusText =
    status === 'connected'
      ? `${myNick} @ ${server?.name}`
      : status === 'connecting'
        ? `Conectando a ${server?.name}...`
        : 'Desconectado';

  return (
    <div ref={barRef} className="menubar" role="menubar">
      <span className="menubar-logo">pIRC</span>
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="menu">
          <button
            type="button"
            className={`menu-title${open === name ? ' open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={open === name}
            onClick={() => setOpen(open === name ? null : name)}
            onPointerEnter={() => open && open !== name && setOpen(name)}
          >
            {name}
          </button>
          {open === name && (
            <div className="menu-items" role="menu">
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(null);
                    item.action?.();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <span className={`connection-status status-${status}`}>{statusText}</span>
    </div>
  );
}
