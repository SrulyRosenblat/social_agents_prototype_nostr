import { useEffect, useState } from 'react';
import { subscribe, type GateRequest } from '@/lib/gate-bridge';
import { OutboundGate } from './OutboundGate';
import { DmGate } from './DmGate';
import { InboundGate } from './InboundGate';

interface GateLayerProps {
  onAfterLabelChange?: () => void;
}

export function GateLayer({ onAfterLabelChange }: GateLayerProps) {
  const [req, setReq] = useState<GateRequest | null>(null);

  useEffect(() => subscribe(setReq), []);

  if (!req) return null;

  if (req.kind === 'outbound') return <OutboundGate req={req} />;
  if (req.kind === 'dm') {
    // Recipient label badges can change after gate decisions; wrapping in a
    // version key isn't needed because the modal opens fresh each request.
    return <DmGate req={req} />;
  }
  if (req.kind === 'inbound') {
    return (
      <InboundGate
        req={{
          ...req,
          resolve: (decision) => {
            req.resolve(decision);
            // Surface label changes upward so the LabelsPopover stays in sync.
            if (
              decision.action === 'label-and-include' ||
              decision.action === 'label-and-skip'
            ) {
              onAfterLabelChange?.();
            }
          },
        }}
      />
    );
  }
  return null;
}
