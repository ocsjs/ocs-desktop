import type { AutomationScript } from '@ocs-desktop/app/src/scripts/script';

export type RawAutomationScript = Pick<AutomationScript, 'configs' | 'name' | 'icon'>;
