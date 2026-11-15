"use strict";
class ReadingEngine {
  constructor() {
    this.ctx = null;
    this.buffer = null;
    this.source = null;
    this.offset = 0;
    this.playing = false;
    this.startedAt = 0;
    this.angleOffset = 0;
    this.bypass = false;
    this.loop = false;
    this.reverse = false;
    this.reverseBuffer = null;
    this.effect = "none";
    this.effectAmount = 0.65;
    this.values = {
      angle: 0,
      distance: 1,
      height: 0,
      reverb: 0.12,
      echo: 0,
      delay: 0.3,
      tone: 12000,
      rate: 1,
      motion: 0,
      rain: 0,
      volume: 0.65,
    };
    this.onend = () => {};
  }
  async init() {
    if (!this.ctx) {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!C) throw new Error("このブラウザーは音声処理に対応していません。");
      this.ctx = new C();
      this.buildGraph();
    }
    await this.ctx.resume();
    if (this.ctx.state !== "running")
      throw new Error(
        "音声を開始できません。再生ボタンをもう一度押してください。",
      );
  }
  buildGraph() {
    const c = this.ctx;
    this.filter = c.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.5;
    this.panner = c.createPanner();
    this.panner.panningModel = "HRTF";
    this.panner.distanceModel = "inverse";
    this.panner.refDistance = 1;
    this.panner.rolloffFactor = 0.35;
    this.panner.maxDistance = 20;
    this.direct = c.createGain();
    this.wet = c.createGain();
    this.echoGain = c.createGain();
    this.raw = c.createGain();
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.compressor = c.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 15;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.18;
    this.convolver = c.createConvolver();
    this.convolver.buffer = this.impulse();
    this.delayNode = c.createDelay(1);
    this.feedback = c.createGain();
    this.feedback.gain.value = 0.28;
    // Parallel dry/effect paths feed the existing spatial processing.
    this.fxInput = c.createGain();
    this.fxDry = c.createGain();
    this.fxWet = c.createGain();
    this.shaper = c.createWaveShaper();
    this.shaper.oversample = "2x";
    this.fxBand = c.createBiquadFilter();
    this.modulator = c.createGain();
    this.carrier = c.createOscillator();
    this.carrierDepth = c.createGain();
    this.fxInput.connect(this.fxDry);
    this.fxDry.connect(this.filter);
    this.fxInput.connect(this.shaper);
    this.shaper.connect(this.fxBand);
    this.fxBand.connect(this.modulator);
    this.modulator.connect(this.fxWet);
    this.fxWet.connect(this.filter);
    this.carrier.connect(this.carrierDepth);
    this.carrierDepth.connect(this.modulator.gain);
    this.carrier.start();
    this.updateEffect();
    this.filter.connect(this.panner);
    this.panner.connect(this.direct);
    this.direct.connect(this.compressor);
    this.panner.connect(this.convolver);
    this.convolver.connect(this.wet);
    this.wet.connect(this.compressor);
    this.panner.connect(this.delayNode);
    this.delayNode.connect(this.feedback);
    this.feedback.connect(this.delayNode);
    this.delayNode.connect(this.echoGain);
    this.echoGain.connect(this.compressor);
    this.raw.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(c.destination);
    this.rainGain = c.createGain();
    this.rainGain.gain.value = 0;
    const rainFilter = c.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 2100;
    rainFilter.Q.value = 0.35;
    const b = c.createBuffer(2, c.sampleRate * 4, c.sampleRate);
    let seed = 75241;
    for (let ch = 0; ch < 2; ch++) {
      let last = 0;
      const d = b.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        seed = (seed * 16807) % 2147483647;
        last = (last + ((seed / 2147483647) * 2 - 1) * 0.08) / 1.04;
        d[i] = last * 3;
      }
    }
    this.rainSource = c.createBufferSource();
    this.rainSource.buffer = b;
    this.rainSource.loop = true;
    this.rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.compressor);
    this.rainSource.start();
    this.updateGraph();
  }
  setEffect(type, amount = this.effectAmount) {
    if (!["none", "crush", "radio", "robot", "tremolo"].includes(type)) return;
    this.effect = type;
    this.effectAmount = Math.max(0, Math.min(1, Number(amount) || 0));
    if (this.ctx) this.updateEffect();
  }
  updateEffect() {
    const type = this.effect,
      amount = this.effectAmount;
    this.shaper.curve = null;
    this.fxBand.type = "allpass";
    this.fxBand.frequency.value = 1600;
    this.fxBand.Q.value = 0.7;
    this.smooth(this.modulator.gain, 1);
    this.smooth(this.carrierDepth.gain, 0);
    if (type === "crush") {
      // 16 amplitude levels plus saturating drive: intentional digital grit.
      const curve = new Float32Array(4097);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = (Math.round(Math.tanh(x * 9) * 8) / 8) * 0.65;
      }
      this.shaper.curve = curve;
    } else if (type === "radio") {
      this.fxBand.type = "bandpass";
      this.fxBand.frequency.value = 1700;
      this.fxBand.Q.value = 1.4;
    } else if (type === "robot") {
      this.carrier.frequency.value = 58;
      this.smooth(this.modulator.gain, 0);
      this.smooth(this.carrierDepth.gain, 1);
    } else if (type === "tremolo") {
      this.carrier.frequency.value = 7;
      this.smooth(this.modulator.gain, 0.55);
      this.smooth(this.carrierDepth.gain, 0.45);
    }
    const mix = type === "none" ? 0 : amount;
    this.smooth(this.fxDry.gain, 1 - mix);
    this.smooth(this.fxWet.gain, mix);
  }
  impulse() {
    const c = this.ctx,
      n = Math.floor(c.sampleRate * 3.2),
      b = c.createBuffer(2, n, c.sampleRate);
    let seed = 34011;
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        seed = (seed * 16807) % 2147483647;
        d[i] =
          ((seed / 2147483647) * 2 - 1) *
          Math.pow(1 - i / n, 3) *
          (i < c.sampleRate * 0.018 ? 0 : 1);
      }
    }
    return b;
  }
  smooth(param, value) {
    param.setTargetAtTime(value, this.ctx.currentTime, 0.025);
  }
  setBuffer(buffer) {
    this.stop();
    this.buffer = buffer;
    this.reverseBuffer = null;
  }
  position() {
    if (!this.buffer) return 0;
    const p =
      this.offset +
      (this.playing
        ? (this.ctx.currentTime - this.startedAt) * this.values.rate
        : 0);
    return this.loop
      ? p % this.buffer.duration
      : Math.min(p, this.buffer.duration);
  }
  set(name, value) {
    if (name === "rate" && this.playing) {
      this.offset = this.position();
      this.startedAt = this.ctx.currentTime;
    }
    if (name === "angle") this.angleOffset = 0;
    this.values[name] = value;
    if (this.ctx) this.updateGraph();
  }
  setBypass(on) {
    this.bypass = on;
    if (this.ctx) this.updateGraph();
  }
  setLoop(on) {
    this.loop = on;
    if (this.source) this.source.loop = on;
  }
  setReverse(on) {
    if (this.reverse === on) return;
    const wasPlaying = this.playing;
    const pos = this.position();
    this.pause();
    this.reverse = on;
    this.offset = this.buffer ? Math.max(0, this.buffer.duration - pos) : 0;
    if (this.buffer && this.offset >= this.buffer.duration - 0.01)
      this.offset = 0;
    if (wasPlaying) this.play();
  }
  updateGraph() {
    const v = this.values;
    this.smooth(
      this.filter.frequency,
      Math.min(
        this.ctx.sampleRate / 2 - 100,
        v.tone / (1 + Math.max(0, v.distance - 1) * 0.11),
      ),
    );
    this.smooth(this.direct.gain, this.bypass ? 0 : 1 - v.reverb * 0.35);
    this.smooth(this.wet.gain, this.bypass ? 0 : v.reverb * 1.1);
    this.smooth(this.echoGain.gain, this.bypass ? 0 : v.echo);
    this.smooth(this.raw.gain, this.bypass ? 1 : 0);
    this.smooth(this.delayNode.delayTime, v.delay);
    this.smooth(this.rainGain.gain, this.bypass || !this.playing ? 0 : v.rain);
    this.smooth(this.master.gain, this.playing ? v.volume : 0);
    if (this.source) this.source.playbackRate.value = v.rate;
    this.updateSpatial(0);
  }
  updateSpatial(delta) {
    if (!this.ctx) return;
    const v = this.values;
    if (this.playing && !this.bypass)
      this.angleOffset = (this.angleOffset + delta * v.motion) % 360;
    const a = ((v.angle + this.angleOffset) * Math.PI) / 180;
    const x = Math.sin(a) * v.distance,
      z = -Math.cos(a) * v.distance;
    this.smooth(this.panner.positionX, x);
    this.smooth(this.panner.positionY, v.height);
    this.smooth(this.panner.positionZ, z);
  }
  reversed() {
    if (!this.reverseBuffer) {
      this.reverseBuffer = this.ctx.createBuffer(
        this.buffer.numberOfChannels,
        this.buffer.length,
        this.buffer.sampleRate,
      );
      for (let c = 0; c < this.buffer.numberOfChannels; c++)
        this.reverseBuffer
          .getChannelData(c)
          .set(this.buffer.getChannelData(c).slice().reverse());
    }
    return this.reverseBuffer;
  }
  play() {
    if (!this.buffer) throw new Error("音声がまだ読み込まれていません。");
    if (this.playing) return;
    if (this.offset >= this.buffer.duration - 0.01) this.offset = 0;
    const s = this.ctx.createBufferSource();
    s.buffer = this.reverse ? this.reversed() : this.buffer;
    s.loop = this.loop;
    s.playbackRate.value = this.values.rate;
    s.connect(this.fxInput);
    s.connect(this.raw);
    this.source = s;
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
    this.updateGraph();
    s.onended = () => {
      if (this.source !== s) return;
      s.disconnect();
      this.source = null;
      this.playing = false;
      this.offset = 0;
      this.updateGraph();
      this.onend();
    };
    s.start(0, this.offset);
  }
  pause() {
    if (this.playing) this.offset = this.position();
    this.playing = false;
    const s = this.source;
    this.source = null;
    if (s) {
      s.onended = null;
      try {
        s.stop();
      } catch {}
      s.disconnect();
    }
    if (this.ctx) this.updateGraph();
  }
  stop() {
    this.pause();
    this.offset = 0;
    this.angleOffset = 0;
  }
  seek(time) {
    const wasPlaying = this.playing;
    this.pause();
    this.offset = Math.max(
      0,
      Math.min(time, this.buffer ? this.buffer.duration : 0),
    );
    if (wasPlaying) this.play();
  }
}
if (typeof module !== "undefined") module.exports = ReadingEngine;
else globalThis.ReadingEngine = ReadingEngine;
