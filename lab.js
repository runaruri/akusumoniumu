"use strict";
const $ = (s) => document.querySelector(s),
  engine = new ReadingEngine(),
  sliders = [...document.querySelectorAll(".control input")],
  cache = new Map();
let requestId = 0,
  loadedKey = null,
  customBuffer = null,
  busy = false,
  lastFrame = 0,
  lastUI = 0;
const texts = [
  [
    "終電が去ったあと、駅には雨の音だけが残った。私は、宛先のない手紙をポケットの中で握りしめていた。",
    "そのとき、誰もいないはずのホームの奥から、声がした。おかえり。その声は、ずっと前に失くした、私自身の声に似ていた。",
    "振り向くと、古い時計の針が、ひとつだけ逆に進んだ。雨は天井からではなく、足もとから、ゆっくり空へ昇っていた。",
  ],
  [
    "待合室の扉を開けると、小さな海があった。椅子の足に波が触れ、壁にかかった時刻表が、白い帆のように揺れていた。",
    "私は手紙を開いた。そこには、たった一行、まだ間に合う、と書かれていた。遠くで汽笛が鳴った。今度は、どちらから聞こえたのか、わからなかった。",
    "目を閉じる。声は近づき、離れ、やがて胸の内側で止まった。私は返事をした。ただいま。雨の駅が、静かに朝へ変わった。",
  ],
];
const base = {
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
const presets = {
  clear: { ...base, distance: 0.6, reverb: 0 },
  station: {
    ...base,
    angle: -35,
    distance: 4,
    reverb: 0.65,
    echo: 0.15,
    delay: 0.42,
    tone: 9200,
    rain: 0.08,
  },
  memory: {
    ...base,
    angle: -90,
    distance: 2.5,
    reverb: 0.48,
    echo: 0.42,
    delay: 0.6,
    rate: 0.92,
    motion: 22,
  },
  dream: {
    ...base,
    angle: 55,
    distance: 2,
    height: 1.8,
    reverb: 0.8,
    echo: 0.25,
    delay: 0.7,
    tone: 2000,
    rate: 0.78,
    motion: 8,
    rain: 0.05,
  },
};
function status(t) {
  $("#status").textContent = t;
}
function formatTime(t) {
  return Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
}
function refresh() {
  sliders.forEach((input) => {
    input.value = engine.values[input.id];
    $("#" + input.id + "-value").value =
      Number(input.value).toLocaleString("ja-JP", {
        maximumFractionDigits: 2,
      }) + input.dataset.unit;
  });
  $("#play").textContent = engine.playing ? "Ⅱ 一時停止" : "▶ 朗読を再生";
  $("#play").disabled = busy;
  $("#seek").disabled = !engine.buffer;
  $("#loop").checked = engine.loop;
  $("#reverse").checked = engine.reverse;
  $("#bypass").setAttribute("aria-pressed", String(engine.bypass));
  $("#bypass").textContent = engine.bypass
    ? "原音で比較中 → 効果ありに戻す"
    : "原音と比較する";
  drawMap();
  if (typeof refreshEffects === "function") refreshEffects();
}
function setBusy(v) {
  busy = v;
  refresh();
}
function drawMap() {
  const v = engine.values,
    a = ((v.angle + engine.angleOffset) * Math.PI) / 180,
    r = 28 + ((v.distance - 0.5) / 7.5) * 115,
    x = 200 + Math.sin(a) * r,
    y = 140 - Math.cos(a) * r * 0.72;
  $("#voice-point").setAttribute("cx", x);
  $("#voice-point").setAttribute("cy", y);
  $("#position-line").setAttribute("x2", x);
  $("#position-line").setAttribute("y2", y);
  $("#voice-point").style.opacity = engine.bypass ? 0.3 : 1;
}
async function ensureBuffer(token) {
  const key = customBuffer ? "custom" : $("#chapter").value;
  if (loadedKey === key && engine.buffer) return true;
  let buffer = customBuffer;
  if (!buffer) {
    if (!cache.has(key)) {
      const binary = atob(NARRATION_AUDIO[Number(key)]),
        data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
      const decoded = await engine.ctx.decodeAudioData(data.buffer);
      cache.set(key, decoded);
    }
    buffer = cache.get(key);
  }
  if (token !== requestId) return false;
  engine.setBuffer(buffer);
  loadedKey = key;
  $("#seek").max = buffer.duration;
  drawWave();
  return true;
}
$("#play").addEventListener("click", async () => {
  if (engine.playing) {
    engine.pause();
    status("一時停止");
    refresh();
    return;
  }
  const token = ++requestId;
  setBusy(true);
  status("朗読音声を準備しています…");
  try {
    await engine.init();
    if (token !== requestId) return;
    if (!(await ensureBuffer(token))) return;
    if (document.hidden) return;
    engine.play();
    status(
      "再生中 · " +
        (customBuffer
          ? "読み込んだ音声"
          : $("#chapter").value === "0"
            ? "第1章"
            : "第2章"),
    );
  } catch (e) {
    if (token === requestId)
      status(
        e.message || "再生できませんでした。ページを再読み込みしてください。",
      );
  } finally {
    if (token === requestId) setBusy(false);
  }
});
$("#stop").addEventListener("click", () => {
  ++requestId;
  setBusy(false);
  engine.stop();
  status("停止 · 先頭に戻りました");
  $("#seek").value = 0;
  refresh();
  drawWave();
});
$("#chapter").addEventListener("change", () => {
  ++requestId;
  engine.stop();
  engine.buffer = null;
  customBuffer = null;
  loadedKey = null;
  $("#file").value = "";
  $("#transcript").textContent =
    texts[Number($("#chapter").value)].join("\n\n");
  $("#seek").value = 0;
  $("#time").textContent = "0:00 / 0:00";
  status("章を選びました。再生ボタンを押してください");
  setBusy(false);
  drawWave();
});
$("#file").addEventListener("change", async () => {
  const file = $("#file").files[0];
  if (!file) return;
  const token = ++requestId;
  engine.stop();
  setBusy(true);
  status("音声を読み込んでいます…");
  try {
    if (file.size > 30 * 1024 * 1024)
      throw new Error("30MB以内の音声を選んでください。");
    await engine.init();
    const buffer = await engine.ctx.decodeAudioData(await file.arrayBuffer());
    if (token !== requestId) return;
    if (buffer.duration > 300)
      throw new Error("5分以内の音声を選んでください。");
    customBuffer = buffer;
    engine.setBuffer(buffer);
    loadedKey = "custom";
    $("#seek").max = buffer.duration;
    $("#transcript").textContent =
      "ご自身の音声：" + file.name + "\nこの音声の文字起こしは行っていません。";
    status("読み込み完了 · " + file.name);
    drawWave();
  } catch (e) {
    if (token === requestId) {
      $("#file").value = "";
      status(
        e.message || "この音声は読み込めません。MP3またはWAVをお試しください。",
      );
    }
  } finally {
    if (token === requestId) setBusy(false);
  }
});
sliders.forEach((input) =>
  input.addEventListener("input", () => {
    engine.set(input.id, Number(input.value));
    document
      .querySelectorAll("[data-preset]")
      .forEach((b) => b.setAttribute("aria-pressed", "false"));
    refresh();
  }),
);
function apply(values) {
  const keepVolume = engine.values.volume;
  Object.entries(values).forEach(([key, value]) =>
    engine.set(key, key === "volume" ? keepVolume : value),
  );
  engine.setBypass(false);
  refresh();
}
document.querySelectorAll("[data-preset]").forEach((button) =>
  button.addEventListener("click", () => {
    apply(presets[button.dataset.preset]);
    document
      .querySelectorAll("[data-preset]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    status(
      (engine.playing ? "再生中 · " : "設定しました · ") +
        button.querySelector("b").textContent,
    );
  }),
);
$("#reset").addEventListener("click", () => {
  engine.setEffect("none", 0.65);
  engine.setReverse(false);
  engine.setLoop(false);
  apply(base);
  document
    .querySelectorAll("[data-preset]")
    .forEach((b) => b.setAttribute("aria-pressed", "false"));
  status("初期設定に戻しました（音量は維持）");
});
$("#loop").addEventListener("change", () => engine.setLoop($("#loop").checked));
$("#reverse").addEventListener("change", () => {
  engine.setReverse($("#reverse").checked);
  status(
    engine.reverse ? "逆再生 · 音の質感を聴く実験" : "通常の朗読に戻しました",
  );
  refresh();
  drawWave();
});
$("#bypass").addEventListener("click", () => {
  engine.setBypass(!engine.bypass);
  refresh();
});
$("#seek").addEventListener("input", () => {
  engine.seek(Number($("#seek").value));
  refresh();
  drawWave();
});
engine.onend = () => {
  status("朗読が終わりました");
  refresh();
  drawWave();
};
function drawWave() {
  const c = $("#wave"),
    w = Math.max(280, Math.round(c.clientWidth)),
    h = 64;
  if (c.width !== w) c.width = w;
  const g = c.getContext("2d");
  g.clearRect(0, 0, w, h);
  g.fillStyle = "#789eaf";
  if (!engine.buffer) {
    g.fillRect(0, 32, w, 1);
    return;
  }
  const d = (engine.reverse ? engine.reversed() : engine.buffer).getChannelData(
    0,
  );
  const ratio = engine.position() / engine.buffer.duration;
  for (let x = 0; x < w; x += 3) {
    let peak = 0;
    const start = Math.floor((x / w) * d.length),
      end = Math.min(d.length, Math.floor(((x + 3) / w) * d.length));
    for (
      let j = start;
      j < end;
      j += Math.max(1, Math.floor((end - start) / 70))
    )
      peak = Math.max(peak, Math.abs(d[j]));
    const bar = Math.max(2, Math.min(58, peak * 90));
    g.fillStyle = x / w < ratio ? "#e9b184" : "#668b9e";
    g.fillRect(x, (h - bar) / 2, 1.5, bar);
  }
}
function frame(now) {
  const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.15) : 0;
  lastFrame = now;
  if (engine.playing) {
    engine.updateSpatial(dt);
    drawMap();
  }
  if (now - lastUI > 100) {
    lastUI = now;
    if (engine.buffer) {
      const pos = engine.position();
      $("#seek").value = pos;
      $("#time").textContent =
        formatTime(pos) + " / " + formatTime(engine.buffer.duration);
      drawWave();
    }
  }
  requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    ++requestId;
    engine.pause();
    setBusy(false);
    status("画面を離れたため一時停止しました");
  }
});
window.addEventListener("pagehide", () => engine.stop());
window.addEventListener("resize", drawWave);
$("#transcript").textContent = texts[0].join("\n\n");
refresh();
drawWave();
requestAnimationFrame(frame);
