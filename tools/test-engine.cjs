const assert = require("node:assert/strict");
class Param {
  constructor(value = 0) {
    this.value = value;
  }
  setTargetAtTime(value) {
    assert(Number.isFinite(value));
    this.value = value;
  }
}
class Node {
  constructor() {
    this.connections = [];
    for (const p of [
      "gain",
      "frequency",
      "Q",
      "positionX",
      "positionY",
      "positionZ",
      "threshold",
      "knee",
      "ratio",
      "attack",
      "release",
      "delayTime",
      "playbackRate",
    ])
      this[p] = new Param();
  }
  connect(n) {
    assert(n);
    this.connections.push(n);
    return n;
  }
  disconnect() {
    this.connections = [];
  }
  start(t, offset) {
    this.startOffset = offset || 0;
  }
  stop() {}
}
class Context {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 1000;
    this.destination = new Node();
    this.state = "running";
  }
  async resume() {
    this.state = "running";
  }
  createBuffer(ch, n, s) {
    const data = Array.from({ length: ch }, () => new Float32Array(n));
    return {
      length: n,
      numberOfChannels: ch,
      sampleRate: s,
      duration: n / s,
      getChannelData: (c) => data[c],
    };
  }
}
for (const k of [
  "Gain",
  "BiquadFilter",
  "Panner",
  "DynamicsCompressor",
  "Convolver",
  "Delay",
  "BufferSource",
  "WaveShaper",
  "Oscillator",
])
  Context.prototype["create" + k] = () => new Node();
global.AudioContext = Context;
const Engine = require(
  require("node:fs").existsSync(
    require("node:path").join(__dirname, "../dist/audio-engine.js"),
  )
    ? "../dist/audio-engine.js"
    : "../audio-engine.js",
);
(async () => {
  const e = new Engine();
  await e.init();
  const b = e.ctx.createBuffer(1, 10000, 1000);
  b.getChannelData(0)[0] = 0.7;
  e.setBuffer(b);
  e.setEffect("crush", 0.8);
  assert.equal(e.fxWet.gain.value, 0.8);
  assert.equal(e.shaper.curve.length, 4097);
  assert(e.shaper.curve.every(Number.isFinite));
  e.setEffect("radio");
  assert.equal(e.fxBand.type, "bandpass");
  assert.equal(e.shaper.curve, null);
  e.setEffect("robot");
  assert.equal(e.modulator.gain.value, 0);
  assert.equal(e.carrier.frequency.value, 58);
  e.setEffect("tremolo");
  assert.equal(e.carrier.frequency.value, 7);
  assert.equal(e.modulator.gain.value, 0.55);
  e.setEffect("none");
  assert.equal(e.fxDry.gain.value, 1);
  assert.equal(e.fxWet.gain.value, 0);
  e.setEffect("crush", 0);
  assert.equal(e.fxDry.gain.value, 1);
  assert.equal(e.fxWet.gain.value, 0);
  e.play();
  e.ctx.currentTime = 2;
  assert.equal(e.position(), 2);
  e.set("rate", 0.5);
  e.ctx.currentTime = 4;
  assert.equal(e.position(), 3);
  e.pause();
  e.ctx.currentTime = 8;
  assert.equal(e.position(), 3);
  e.play();
  e.ctx.currentTime = 10;
  assert.equal(e.position(), 4);
  e.seek(6);
  assert.equal(e.source.startOffset, 6);
  e.setReverse(true);
  assert.equal(e.offset, 4);
  assert.equal(e.source.buffer.getChannelData(0)[9999], b.getChannelData(0)[0]);
  e.set("angle", 90);
  e.set("distance", 2);
  assert(Math.abs(e.panner.positionX.value - 2) < 1e-6);
  e.set("height", 1.2);
  assert.equal(e.panner.positionY.value, 1.2);
  e.set("reverb", 0.8);
  e.set("echo", 0.4);
  e.set("tone", 1000);
  assert(e.wet.gain.value > 0);
  assert.equal(e.echoGain.gain.value, 0.4);
  assert(e.filter.frequency.value < 1000);
  e.setBypass(true);
  assert.equal(e.wet.gain.value, 0);
  assert.equal(e.direct.gain.value, 0);
  assert.equal(e.raw.gain.value, 1);
  e.setBypass(false);
  assert.equal(e.raw.gain.value, 0);
  e.setLoop(true);
  e.seek(9);
  e.set("rate", 1);
  e.ctx.currentTime += 3;
  assert.equal(e.position(), 2);
  e.stop();
  assert.equal(e.source, null);
  assert.equal(e.offset, 0);
  assert.equal(e.master.gain.value, 0);
  assert.equal(e.rainGain.gain.value, 0);
  console.log(
    "PASS: transport, rate continuity, pause/resume, seek, reversal, 3D coordinates, effect routing, bypass, loop and stop",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
