import type { PlaywrightScript } from '@ocs-desktop/app/src/scripts/script';

export type RawPlaywrightScript = Pick<PlaywrightScript, 'configs' | 'name'>;
