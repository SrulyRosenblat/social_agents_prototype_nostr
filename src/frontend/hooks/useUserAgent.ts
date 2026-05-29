import { useCallback, useEffect, useRef, useState } from 'react';
import {
  initUserAgent,
  runTurn,
  type ChatMessage,
  type ListeningState,
  type LogLevel,
  type UserAgentState,
} from '../user-agent';
import { demoRecorder } from '../lib/demo-recorder';

export interface LogEntry {
  id: string;
  ts: Date;
  level: LogLevel | 'info';
  message: string;
}

export interface ChatItem {
  id: string;
  msg: ChatMessage;
}

export type ConnectionStatus = 'connecting' | 'ready' | 'offline';

let monoCounter = 0;
function nextId(prefix: string): string {
  monoCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${monoCounter}`;
}

export interface UseUserAgentResult {
  status: ConnectionStatus;
  userPubkey: string | null;
  chat: ChatItem[];
  log: LogEntry[];
  listening: ListeningState | null;
  /** Increments whenever the label store may have changed. */
  labelsVersion: number;
  send: (question: string) => Promise<void>;
  pending: boolean;
  clearLog: () => void;
}

export function useUserAgent(): UseUserAgentResult {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [listening, setListening] = useState<ListeningState | null>(null);
  const [labelsVersion, setLabelsVersion] = useState(0);
  const [pending, setPending] = useState(false);

  const stateRef = useRef<UserAgentState | null>(null);

  const append = useCallback((msg: ChatMessage) => {
    setChat((cur) => [...cur, { id: nextId('chat'), msg }]);
    demoRecorder.chat(msg);
  }, []);

  const logFn = useCallback((message: string, level: LogLevel = 'info') => {
    setLog((cur) => [
      { id: nextId('log'), ts: new Date(), level, message },
      ...cur,
    ]);
    demoRecorder.log(level, message);
  }, []);

  const setListeningFn = useCallback((s: ListeningState | null) => {
    setListening(s);
    if (s) demoRecorder.listeningStart(s.windowSec, s.audience);
    else demoRecorder.listeningStop();
  }, []);

  const refreshLabelView = useCallback(() => {
    setLabelsVersion((v) => v + 1);
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await initUserAgent();
        if (cancelled) return;
        stateRef.current = s;
        setUserPubkey(s.userPubkey);
        setStatus('ready');
        logFn(`user agent ready · pubkey ${s.userPubkey.slice(0, 16)}…`, 'system');
      } catch (err) {
        if (cancelled) return;
        logFn(`failed to reach server: ${String(err)} — is it running?`, 'warn');
        setStatus('offline');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logFn]);

  const send = useCallback(
    async (question: string) => {
      if (!stateRef.current) return;
      const q = question.trim();
      if (!q) return;
      setPending(true);
      try {
        await runTurn(stateRef.current, q, {
          log: logFn,
          appendChat: append,
          refreshLabelView,
          setListening: setListeningFn,
        });
      } catch (err) {
        logFn(`error: ${String(err)}`, 'warn');
      } finally {
        setPending(false);
      }
    },
    [append, logFn, refreshLabelView, setListeningFn],
  );

  return {
    status,
    userPubkey,
    chat,
    log,
    listening,
    labelsVersion,
    send,
    pending,
    clearLog,
  };
}
