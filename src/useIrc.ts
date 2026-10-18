import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ClientState, IrcClient } from './irc/IrcClient';

export const IrcContext = createContext<IrcClient | null>(null);

export function useIrcClient(): IrcClient {
  const client = useContext(IrcContext);
  if (!client) {
    throw new Error('useIrcClient must be used inside IrcContext');
  }
  return client;
}

/** The state of the IRC client, the component is rendered again when it changes */
export function useIrcState(): ClientState {
  const client = useIrcClient();
  return useSyncExternalStore(client.subscribe, client.getState);
}
