import { KeyboardEvent, memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChatWindowState } from '../irc/IrcClient';
import { stripStatus } from '../irc/nickList';
import { useIrcClient } from '../useIrc';

/** Lines typed in a window, recalled with the up and down arrows */
const HISTORY_SIZE = 50;

interface ChatViewProps {
  window: ChatWindowState;
  active: boolean;
}

/**
 * The messages, the field to type text and, in a channel, the nicknames.
 * Port of ChatWindow.java and PIRCChannelWindow.java.
 */
function ChatView({ window: w, active }: ChatViewProps) {
  const client = useIrcClient();
  const linesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);
  const [text, setText] = useState('');
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const [selectedNick, setSelectedNick] = useState<string | null>(null);

  /* keeps the last line visible, unless the user scrolled up */
  useLayoutEffect(() => {
    const el = linesRef.current;
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [w.lines]);

  useEffect(() => {
    if (active) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [active]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (text.trim() !== '') {
        client.sendInput(w.id, text);
        history.current = [text, ...history.current.filter((h) => h !== text)].slice(0, HISTORY_SIZE);
      }
      historyIndex.current = -1;
      setText('');
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const next = historyIndex.current + (e.key === 'ArrowUp' ? 1 : -1);
      if (next >= -1 && next < history.current.length) {
        e.preventDefault();
        historyIndex.current = next;
        setText(next === -1 ? '' : history.current[next]);
      }
    }
  };

  const placeholder =
    w.kind === 'main'
      ? 'Comandos para o servidor: /join #canal, /nick, /msg nick texto...'
      : `Mensagem para ${w.title}`;

  return (
    <div className="chat">
      {w.kind === 'channel' && (
        <div className="chat-topic" title={w.topic}>
          {w.topic || ' '}
        </div>
      )}
      <div className="chat-main">
        <div
          ref={linesRef}
          className="chat-lines"
          role="log"
          aria-live="polite"
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
          {w.lines.map((line) => (
            <div key={line.id} className={`chat-line line-${line.kind}`}>
              {w.timeStamped && <span className="chat-time">[{line.time}]</span>}
              {w.timeStamped && '  '}
              {line.text}
            </div>
          ))}
        </div>
        {w.kind === 'channel' && (
          <ul className="nick-list" aria-label={`Nicknames em ${w.title}`}>
            {w.nicks.map((nick) => (
              <li
                key={nick}
                className={selectedNick === nick ? 'selected' : undefined}
                title="Duplo clique para abrir uma conversa privada"
                onClick={() => setSelectedNick(nick)}
                onDoubleClick={() => client.openPrivate(nick)}
              >
                {nick.startsWith('@') || nick.startsWith('+') ? (
                  <span className={nick.startsWith('@') ? 'nick-op' : 'nick-voice'}>{nick.charAt(0)}</span>
                ) : null}
                {stripStatus(nick)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        ref={inputRef}
        className="chat-input"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

export default memo(ChatView);
