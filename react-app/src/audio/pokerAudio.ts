export type SoundKind = 'deal' | 'flip' | 'call' | 'raise' | 'check' | 'fold' | 'turn' | 'win' | 'end';
export interface SoundPreferences { enabled: boolean; volume: number }
const STORAGE_KEY = 'ai4poker.sound.v1';
export function readSoundPreferences(): SoundPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { enabled: typeof saved.enabled === 'boolean' ? saved.enabled : true,
      volume: typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : 0.4 };
  } catch { return { enabled: true, volume: 0.4 }; }
}
export function saveSoundPreferences(value: SoundPreferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ }
}

/** Short, locally synthesized cues; no downloads, music loops or external assets. */
export class PokerAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes = new Set<AudioScheduledSourceNode>();
  private preferences: SoundPreferences = { enabled: false, volume: 0.4 };
  private disposed = false;
  private options: { createContext?: () => AudioContext; visible?: () => boolean };
  constructor(options: { createContext?: () => AudioContext; visible?: () => boolean } = {}) { this.options = options; }
  configure(preferences: SoundPreferences) {
    this.preferences = { enabled: preferences.enabled, volume: Math.min(1, Math.max(0, preferences.volume)) };
    if (this.master && this.context) this.master.gain.setValueAtTime(this.preferences.enabled ? this.preferences.volume * 0.3 : 0, this.context.currentTime);
    if (!preferences.enabled || preferences.volume === 0) this.stop();
  }
  async unlock(): Promise<boolean> {
    if (this.disposed || !this.preferences.enabled) return false;
    try {
      if (!this.context) {
        const factory = this.options.createContext || (() => {
          const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Audio) throw new Error('Audio unavailable');
          return new Audio();
        });
        this.context = factory();
        this.master = this.context.createGain();
        this.master.gain.value = this.preferences.volume * 0.3;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context.state === 'running';
    } catch { return false; }
  }
  play(kind: SoundKind, delay = 0) {
    const c = this.context;
    const visible = this.options.visible?.() ?? (typeof document === 'undefined' || !document.hidden);
    if (!c || !this.master || c.state !== 'running' || !visible || !this.preferences.enabled || this.preferences.volume <= 0 || this.disposed) return;
    const at = c.currentTime + delay;
    const tone = (frequency: number, time: number, duration: number, gain: number, endFrequency = frequency) => {
      const source = c.createOscillator();
      const envelope = c.createGain();
      source.type = 'sine';
      source.frequency.setValueAtTime(frequency, time);
      source.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.linearRampToValueAtTime(gain, time + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      source.connect(envelope); envelope.connect(this.master!);
      this.track(source, () => envelope.disconnect());
      source.start(time); source.stop(time + duration + 0.01);
    };
    const paper = (time: number, duration: number, frequency: number, gain: number) => {
      const source = c.createBufferSource();
      const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      source.buffer = buffer;
      const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 0.7;
      const envelope = c.createGain();
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.linearRampToValueAtTime(gain, time + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      source.connect(filter); filter.connect(envelope); envelope.connect(this.master!);
      this.track(source, () => { filter.disconnect(); envelope.disconnect(); });
      source.start(time); source.stop(time + duration + 0.01);
    };
    try {
      if (kind === 'deal' || kind === 'flip') {
        paper(at, 0.07, kind === 'deal' ? 2400 : 1800, 0.35);
        if (kind === 'flip') tone(220, at + 0.012, 0.055, 0.15, 100);
      } else if (kind === 'fold') paper(at, 0.14, 1000, 0.25);
      else if (kind === 'check') { tone(260, at, 0.06, 0.5, 120); tone(260, at + 0.08, 0.05, 0.28, 120); }
      else if (kind === 'call' || kind === 'raise') {
        paper(at, 0.035, 3400, 0.28); tone(1800, at, 0.045, 0.14);
        if (kind === 'raise') { paper(at + 0.05, 0.04, 3900, 0.25); tone(2400, at + 0.05, 0.04, 0.1); }
      } else if (kind === 'turn') { tone(660, at, 0.15, 0.15); tone(880, at + 0.08, 0.18, 0.1); }
      else if (kind === 'win') [523.25, 659.25, 783.99].forEach((n, i) => tone(n, at + i * 0.1, 0.28, 0.14));
      else tone(330, at, 0.18, 0.1, 260);
    } catch { this.stop(); /* Audio failure must not interrupt a hand. */ }
  }
  private track(source: AudioScheduledSourceNode, cleanup: () => void) {
    this.nodes.add(source);
    source.onended = () => { source.disconnect(); cleanup(); this.nodes.delete(source); };
  }
  stop() {
    for (const source of this.nodes) { try { source.stop(); } catch { /* Already ended. */ } }
    this.nodes.clear();
  }
  async dispose() {
    this.disposed = true; this.stop(); this.master?.disconnect();
    try { await this.context?.close(); } catch { /* Browser may already have closed it. */ }
    this.context = null; this.master = null;
  }
}
