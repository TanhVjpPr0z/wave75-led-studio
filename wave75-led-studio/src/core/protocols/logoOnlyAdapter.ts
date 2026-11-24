import { QmkViaLightingAdapter } from './qmkViaAdapter';
import type { AdapterContext, ProtocolTransportMode, WaveCapabilities } from './types';

/**
 * Streamlined adapter for PMO WAVE75 Standard (Non-RGB Edition — 无光版).
 * Controls exclusively the CNC Wave Logo RGB indicator (color, brightness, speed, saturation, mode).
 */
export class LogoOnlyAdapter extends QmkViaLightingAdapter {
  override readonly transportMode: ProtocolTransportMode = 'logo_only';
  override readonly displayName: string = 'PMO WAVE75 Non-RGB (Logo LED Only)';

  override async connect(
    device: HIDDevice,
    context: AdapterContext
  ): Promise<WaveCapabilities> {
    await super.connect(device, context);
    context.logTraffic(
      'info',
      '0x07',
      null,
      'Bound WAVE75 Non-RGB Logo-Only controller (per-key RGB disabled on this hardware)'
    );
    return {
      supportsPerKeySync: false,
      supportsOnboardSlots: false,
      supportsQmkLighting: true,
      logoOnly: true,
      maxSafeFps: 15,
      slotCount: 0,
      protocolName: 'WAVE75 Non-RGB (CNC Logo Only)',
    };
  }
}
