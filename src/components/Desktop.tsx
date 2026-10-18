import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { ChatWindowState, MAIN_WINDOW } from '../irc/IrcClient';
import { useIrcClient, useIrcState } from '../useIrc';
import ChatView from './ChatView';

interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
  minimized: boolean;
  maximized: boolean;
}

const MIN_WIDTH = 220;
const MIN_HEIGHT = 140;
const TITLE_HEIGHT = 26;

/** Initial size of the windows, as in the Swing version */
function initialGeometry(win: ChatWindowState, index: number, desktop: DOMRect): Geometry {
  if (win.kind === 'main') {
    return { x: 0, y: 0, w: desktop.width, h: Math.min(500, desktop.height), minimized: false, maximized: false };
  }
  const [w, h] = win.kind === 'channel' ? [700, 400] : [400, 400];
  const offset = 28 * (index % 8);
  return {
    x: Math.max(0, Math.min(40 + offset, desktop.width - w)),
    y: Math.max(0, Math.min(40 + offset, desktop.height - h)),
    w: Math.min(w, desktop.width),
    h: Math.min(h, desktop.height),
    minimized: false,
    maximized: false,
  };
}

/**
 * The pIRC desktop, port of the JDesktopPane of PIRCFrame: each channel,
 * private conversation and the server messages have their own window.
 * The windows can be moved, resized, minimized and maximized; the bar
 * at the bottom lists them.
 */
export default function Desktop() {
  const client = useIrcClient();
  const { windows, activeId } = useIrcState();
  const desktopRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Record<string, Geometry>>({});
  /** window ids from the back to the front */
  const [order, setOrder] = useState<string[]>([MAIN_WINDOW]);
  const opened = useRef(0);

  /* places the new windows and forgets the closed ones */
  useEffect(() => {
    const rect = desktopRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    setGeometry((current) => {
      const next: Record<string, Geometry> = {};
      for (const win of windows) {
        next[win.id] = current[win.id] ?? initialGeometry(win, opened.current++, rect);
      }
      return next;
    });
    setOrder((current) => {
      const ids = new Set(windows.map((w) => w.id));
      const kept = current.filter((id) => ids.has(id));
      return [...kept, ...windows.map((w) => w.id).filter((id) => !kept.includes(id))];
    });
  }, [windows]);

  /* the active window is shown in front of the others */
  useEffect(() => {
    setOrder((current) => [...current.filter((id) => id !== activeId), activeId]);
    setGeometry((current) =>
      current[activeId]?.minimized ? { ...current, [activeId]: { ...current[activeId], minimized: false } } : current,
    );
  }, [activeId]);

  const update = (id: string, change: Partial<Geometry>) =>
    setGeometry((current) => (current[id] ? { ...current, [id]: { ...current[id], ...change } } : current));

  /** Moves or resizes a window while the pointer is pressed */
  const track = (e: ReactPointerEvent, id: string, mode: 'move' | 'resize') => {
    const g = geometry[id];
    const desktop = desktopRef.current?.getBoundingClientRect();
    if (!g || !desktop || g.maximized || e.button !== 0) {
      return;
    }
    e.preventDefault();
    client.activate(id);
    const startX = e.clientX;
    const startY = e.clientY;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (mode === 'move') {
        update(id, {
          x: Math.min(Math.max(g.x + dx, 60 - g.w), desktop.width - 60),
          y: Math.min(Math.max(g.y + dy, 0), desktop.height - TITLE_HEIGHT),
        });
      } else {
        update(id, { w: Math.max(MIN_WIDTH, g.w + dx), h: Math.max(MIN_HEIGHT, g.h + dy) });
      }
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  const minimize = (id: string) => {
    update(id, { minimized: true });
    const visible = order.filter((o) => o !== id && !geometry[o]?.minimized);
    if (visible.length > 0) {
      client.activate(visible[visible.length - 1]);
    }
  };

  return (
    <div className="desktop-area">
      <div ref={desktopRef} className="desktop">
        {windows.map((win) => {
          const g = geometry[win.id];
          if (!g) {
            return null;
          }
          const active = win.id === activeId;
          const closable = win.kind !== 'main';
          return (
            <section
              key={win.id}
              className={`frame${active ? ' active' : ''}${g.maximized ? ' maximized' : ''}`}
              hidden={g.minimized}
              aria-label={win.title}
              style={{
                left: g.x,
                top: g.y,
                width: g.w,
                height: g.h,
                zIndex: order.indexOf(win.id) + 1,
              }}
              onPointerDownCapture={() => !active && client.activate(win.id)}
            >
              <header
                className="frame-titlebar"
                onPointerDown={(e) => track(e, win.id, 'move')}
                onDoubleClick={() => update(win.id, { maximized: !g.maximized })}
              >
                <span className="frame-title">
                  {win.title}
                  {win.kind === 'channel' && <span className="frame-count"> [{win.nicks.length}]</span>}
                </span>
                <span className="frame-buttons" onPointerDown={(e) => e.stopPropagation()}>
                  <button type="button" className="frame-button" aria-label="Minimizar" onClick={() => minimize(win.id)}>
                    _
                  </button>
                  <button
                    type="button"
                    className="frame-button"
                    aria-label={g.maximized ? 'Restaurar' : 'Maximizar'}
                    onClick={() => update(win.id, { maximized: !g.maximized })}
                  >
                    {g.maximized ? '❐' : '□'}
                  </button>
                  {closable && (
                    <button
                      type="button"
                      className="frame-button frame-close"
                      aria-label="Fechar"
                      onClick={() => client.closeWindow(win.id)}
                    >
                      ×
                    </button>
                  )}
                </span>
              </header>
              <ChatView window={win} active={active} />
              {!g.maximized && (
                <div className="frame-resize" aria-hidden="true" onPointerDown={(e) => track(e, win.id, 'resize')} />
              )}
            </section>
          );
        })}
      </div>
      <nav className="taskbar" aria-label="Janelas">
        {windows.map((win) => (
          <button
            key={win.id}
            type="button"
            className={`task${win.id === activeId && !geometry[win.id]?.minimized ? ' active' : ''}${
              win.unread ? ' unread' : ''
            }`}
            onClick={() => {
              if (win.id === activeId && !geometry[win.id]?.minimized) {
                minimize(win.id);
              } else {
                update(win.id, { minimized: false });
                client.activate(win.id);
              }
            }}
          >
            {win.title}
          </button>
        ))}
      </nav>
    </div>
  );
}
