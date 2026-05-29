import { useEffect, useState } from 'react';
import { demoRecorder } from '../lib/demo-recorder';

export function useDemoRecorderSize(): number {
  const [size, setSize] = useState(demoRecorder.size());
  useEffect(() => demoRecorder.subscribe(setSize), []);
  return size;
}
