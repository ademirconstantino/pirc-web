import { useCallback, useEffect, useState } from 'react';
import ConnectionDialog from './components/ConnectionDialog';
import Desktop from './components/Desktop';
import ErrorDialog from './components/ErrorDialog';
import MenuBar from './components/MenuBar';
import Splash from './components/Splash';
import { IrcClient } from './irc/IrcClient';
import { IrcContext, useIrcClient, useIrcState } from './useIrc';

/** The main pIRC window, port of PIRCFrame.java */
function PIRC() {
  const client = useIrcClient();
  const { error } = useIrcState();
  const [splash, setSplash] = useState<'start' | 'about' | null>('start');
  const [connecting, setConnecting] = useState(false);
  const closeSplash = useCallback(() => setSplash(null), []);

  /* sends the quit message when the page is closed */
  useEffect(() => {
    const quit = () => client.disconnect();
    window.addEventListener('pagehide', quit);
    return () => window.removeEventListener('pagehide', quit);
  }, [client]);

  return (
    <div className="pirc">
      <MenuBar onConnect={() => setConnecting(true)} onAbout={() => setSplash('about')} />
      <Desktop />
      {connecting && (
        <ConnectionDialog
          onClose={() => setConnecting(false)}
          onConnect={(params) => {
            setConnecting(false);
            client.connect(params);
          }}
        />
      )}
      {error && <ErrorDialog error={error} onClose={() => client.dismissError()} />}
      {splash && <Splash auto={splash === 'start'} onClose={closeSplash} />}
    </div>
  );
}

export default function App() {
  const [client] = useState(() => new IrcClient());
  return (
    <IrcContext.Provider value={client}>
      <PIRC />
    </IrcContext.Provider>
  );
}
