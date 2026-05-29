import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Topbar } from '@/components/Topbar';
import { ChatPane } from '@/components/ChatPane';
import { Sidebar } from '@/components/Sidebar';
import { GateLayer } from '@/components/gates/GateLayer';
import { useUserAgent } from '@/hooks/useUserAgent';

export function App() {
  const agent = useUserAgent();
  const [labelsBumpFromGate, setLabelsBumpFromGate] = useState(0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-background text-foreground">
        <Topbar
          status={agent.status}
          userPubkey={agent.userPubkey}
          labelsVersion={agent.labelsVersion + labelsBumpFromGate}
        />
        <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
          <ChatPane
            chat={agent.chat}
            listening={agent.listening}
            pending={agent.pending}
            disabled={agent.status !== 'ready'}
            onSend={agent.send}
          />
          <Sidebar
            log={agent.log}
            onClear={agent.clearLog}
            className="hidden lg:flex"
          />
        </main>
        <GateLayer onAfterLabelChange={() => setLabelsBumpFromGate((v) => v + 1)} />
      </div>
    </TooltipProvider>
  );
}
