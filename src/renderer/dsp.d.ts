import type { DspApi } from '../preload/index';

declare global {
  interface Window {
    dsp: DspApi;
  }
}
