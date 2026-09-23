// Client-side ambient audio generator driven by mood params (valence/energy/tempo).
// No backend audio processing — everything here is oscillators/filters/gain nodes
// via the Web Audio API, per spec §2. Mobile browsers block audio before a user
// gesture, so `start()` must be called from a click/tap handler.

const NOTE_SCALES = {
  // Simple pentatonic-ish interval sets in semitones from a root, picked by valence.
  low: [0, 3, 5, 7, 10], // minor-leaning, moodier
  high: [0, 2, 4, 7, 9], // major-leaning, brighter
};

function semitoneToRatio(semitones) {
  return Math.pow(2, semitones / 12);
}

export class AmbientEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voices = [];
    this.lfo = null;
    this.lfoGain = null;
    this.filter = null;
    this.analyser = null; // output analyser, for the visualizer
    this.micAnalyser = null; // mic input analyser, for mic-energy reads
    this.micSource = null;
    this.micStream = null;
    this.running = false;
    this.rootFreq = 110; // A2
  }

  isRunning() {
    return this.running;
  }

  start() {
    if (this.running) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 900;
    this.filter.Q.value = 0.7;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.filter.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Three detuned voices form a simple evolving pad.
    const intervals = NOTE_SCALES.high.slice(0, 3);
    this.voices = intervals.map((semi, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = this.rootFreq * semitoneToRatio(semi);
      const gain = this.ctx.createGain();
      gain.gain.value = 0.25;
      osc.connect(gain);
      gain.connect(this.filter);
      osc.start();
      return { osc, gain, baseSemi: semi };
    });

    // Slow LFO modulates filter cutoff so the pad breathes instead of sitting static.
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 0.08;
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 300;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
    this.lfo.start();

    // Fade in.
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0.0001, now);
    this.master.gain.exponentialRampToValueAtTime(0.18, now + 1.5);

    this.running = true;
  }

  stop() {
    if (!this.running || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.0001, now + 0.8);

    const ctxToClose = this.ctx;
    const voices = this.voices;
    const lfo = this.lfo;
    setTimeout(() => {
      voices.forEach(({ osc }) => {
        try {
          osc.stop();
        } catch {
          // already stopped
        }
      });
      try {
        lfo.stop();
      } catch {
        // already stopped
      }
      ctxToClose.close();
    }, 900);

    this.stopMic();
    this.running = false;
    this.ctx = null;
  }

  /** mood: {valence: 0-1, energy: 0-1, tempo: bpm} */
  setMood(mood) {
    if (!this.running || !this.ctx) return;
    const { valence = 0.5, energy = 0.5, tempo = 100 } = mood;
    const now = this.ctx.currentTime;

    const scale = valence >= 0.5 ? NOTE_SCALES.high : NOTE_SCALES.low;
    this.voices.forEach((voice, i) => {
      const semi = scale[i % scale.length];
      const targetFreq = this.rootFreq * semitoneToRatio(semi);
      voice.osc.frequency.cancelScheduledValues(now);
      voice.osc.frequency.linearRampToValueAtTime(targetFreq, now + 2.5);
      voice.baseSemi = semi;
    });

    // Energy -> brightness (filter cutoff) and overall level.
    const targetCutoff = 400 + energy * 3200;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.linearRampToValueAtTime(targetCutoff, now + 2);

    const targetGain = 0.08 + energy * 0.22;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(targetGain, now + 2);

    // Tempo -> LFO rate (a slow pulse tied loosely to the mood's BPM).
    const lfoHz = Math.max(0.03, tempo / 60 / 8);
    this.lfo.frequency.cancelScheduledValues(now);
    this.lfo.frequency.linearRampToValueAtTime(lfoHz, now + 1);
  }

  /** Returns frequency-domain bytes for the visualizer canvas. */
  getVisualizerData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  async connectMic() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micSource = this.ctx.createMediaStreamSource(this.micStream);
    this.micAnalyser = this.ctx.createAnalyser();
    this.micAnalyser.fftSize = 1024;
    this.micSource.connect(this.micAnalyser);
  }

  /** RMS-based energy reading from the mic, normalized roughly to 0-1. */
  getMicEnergy() {
    if (!this.micAnalyser) return 0;
    const data = new Uint8Array(this.micAnalyser.fftSize);
    this.micAnalyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const centered = (data[i] - 128) / 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    return Math.min(1, rms * 4);
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.micSource = null;
    this.micAnalyser = null;
  }
}
