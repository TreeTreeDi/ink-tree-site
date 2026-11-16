import type { TrackSpec } from '../data/siteContent';

/**
 * Self-contained WebAudio ambient synthesizer (zero external copyrighted audio).
 */
export class AmbientSynthPlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timerId: number | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private playing = false;
  private muted = false;
  private step = 0;
  private preset: TrackSpec['preset'] = 'rhodes';

  private ensureContext() {
    if (this.ctx) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.16;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1400;
    this.filter.Q.value = 0.7;

    // Gentle stereo-like delay feedback loop
    const delay = this.ctx.createDelay(1.0);
    delay.delayTime.value = 0.38;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.34;
    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 950;

    this.filter.connect(this.masterGain);
    this.filter.connect(delay);
    delay.connect(delayFilter);
    delayFilter.connect(fb);
    fb.connect(delay);
    delayFilter.connect(this.masterGain);

    this.masterGain.connect(this.ctx.destination);
  }

  private playNote(freq: number, durationSec: number, type: OscillatorType, vol = 0.25) {
    if (!this.ctx || !this.filter) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(g);
    g.connect(this.filter);
    osc.start(now);
    osc.stop(now + durationSec + 0.05);
  }

  private startNoiseLayer() {
    if (!this.ctx || !this.filter || this.noiseSource) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.025 * white) / 1.025;
      data[i] = lastOut * 2.2;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const g = this.ctx.createGain();
    g.gain.value = this.preset === 'rain' ? 0.14 : 0.0;
    src.connect(g);
    g.connect(this.filter);
    src.start();
    this.noiseSource = src;
    this.noiseGain = g;
  }

  private stopNoiseLayer() {
    if (this.noiseGain && this.ctx) {
      this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  private tick = () => {
    if (!this.playing) return;
    const scales: Record<TrackSpec['preset'], number[]> = {
      rhodes: [220, 261.63, 329.63, 392, 440, 329.63, 293.66, 392],
      kalimba: [293.66, 349.23, 440, 523.25, 440, 392, 349.23, 261.63],
      rain: [196, 293.66, 392, 587.33, 440, 329.63],
    };
    const notes = scales[this.preset];
    const freq = notes[this.step % notes.length];

    if (this.preset === 'rhodes') {
      this.playNote(freq, 2.2, 'triangle', 0.22);
      if (this.step % 2 === 0) {
        this.playNote(freq * 0.5, 2.8, 'sine', 0.16);
      }
    } else if (this.preset === 'kalimba') {
      this.playNote(freq, 0.9, 'sine', 0.26);
      this.playNote(freq * 2, 0.35, 'triangle', 0.06);
    } else {
      this.playNote(freq, 2.6, 'sine', 0.15);
    }

    if (this.noiseGain && this.ctx) {
      this.noiseGain.gain.setTargetAtTime(
        this.preset === 'rain' ? 0.14 : 0.012,
        this.ctx.currentTime,
        0.2,
      );
    }

    this.step++;
    const intervalMs = this.preset === 'kalimba' ? 620 : this.preset === 'rain' ? 1150 : 950;
    this.timerId = window.setTimeout(this.tick, intervalMs);
  };

  public async play(preset?: TrackSpec['preset']) {
    if (preset) this.preset = preset;
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.startNoiseLayer();
    if (!this.playing) {
      this.playing = true;
      this.tick();
    }
  }

  public pause() {
    this.playing = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.stopNoiseLayer();
  }

  public setPreset(preset: TrackSpec['preset']) {
    this.preset = preset;
    if (this.noiseGain && this.ctx && this.playing) {
      this.noiseGain.gain.setTargetAtTime(
        preset === 'rain' ? 0.14 : 0.012,
        this.ctx.currentTime,
        0.15,
      );
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.16, this.ctx.currentTime, 0.06);
    }
  }

  public dispose() {
    this.pause();
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
      } catch {
        // ignore if already stopped
      }
      this.noiseSource.disconnect();
      this.noiseSource = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
