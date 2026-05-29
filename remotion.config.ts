import { Config } from '@remotion/cli/config';
import { enableTailwind } from '@remotion/tailwind';

Config.overrideWebpackConfig((current) => enableTailwind(current));
Config.setVideoImageFormat('jpeg');
Config.setConcurrency(1);
