// Plays a real playlist (from /api/me/playlist) through an <audio> element,
// routed through an AnalyserNode so the visualizer reacts to the actual song.
// Falls back to plain <audio> playback (no visualizer reactivity) if the
// Deezer preview host doesn't allow the CORS-tainted Web Audio hookup.

export class TrackPlayer {
  constructor() {
    this.ctx = null;
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";
    this.analyser = null;
    this._endedCallback = null;
    this.audio.addEventListener("ended", () => {
      if (this._endedCallback) this._endedCallback();
    });
  }

  _ensureGraph() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      const source = this.ctx.createMediaElementSource(this.audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    } catch {
      // Analyser hookup failed (e.g. CORS) — audio still plays via the
      // element's default output, just without visualizer data.
      this.ctx = null;
      this.analyser = null;
    }
  }

  onEnded(callback) {
    this._endedCallback = callback;
  }

  async load(url) {
    this._ensureGraph();
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume().catch(() => {});
    }
    this.audio.src = url;
    return this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  resume() {
    return this.audio.play();
  }

  isPlaying() {
    return !this.audio.paused && !this.audio.ended;
  }

  getVisualizerData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  stop() {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}

// Separate, minimal mic-energy reader — independent AudioContext from
// TrackPlayer's so playback and mic analysis never fight over the same graph.
export class MicMonitor {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
  }

  async connect() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);
  }

  /** RMS-based energy reading, normalized roughly to 0-1. */
  getEnergy() {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const centered = (data[i] - 128) / 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    return Math.min(1, rms * 4);
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.analyser = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
