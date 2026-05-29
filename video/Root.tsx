import * as R from 'remotion';
import { Flow } from './Flow';
import { buildTimeline } from './timeline';
import type { FlowProps } from './types';

export function Root() {
  return (
    <R.Composition
      id="Flow"
      component={Flow}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={150}
      defaultProps={{
        beatFrames: 75,
        events: [],
      } satisfies FlowProps}
      calculateMetadata={({ props }: { props: FlowProps }) => {
        const { totalFrames } = buildTimeline(props);
        return { durationInFrames: Math.max(120, totalFrames) };
      }}
    />
  );
}
