"use strict";
// This file deliberately shares the lab's engine and slider controls.
const effectDescriptions = {
  none: "加工なし。方向・距離・残響などの設定はそのまま使えます。",
  crush:
    "声の振幅を段階的に粗くし、歪みを加えます。壊れた放送や、途切れた記憶のような質感に。",
  radio:
    "声の中域を中心に残します。古い受信機から聞こえるような、細くこもった質感に。",
  robot:
    "58Hzのリング変調を加えます。声に金属的な響きが重なり、人間と機械のあいだの質感に。",
  tremolo:
    "1秒に7回、音量を揺らします。声の輪郭に脈動が生まれ、不安や緊張を表現できます。",
};
function refreshEffects() {
  document
    .querySelectorAll("[data-effect]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.effect === engine.effect),
      ),
    );
  $("#effect-amount").value = engine.effectAmount;
  $("#effect-amount").disabled = engine.effect === "none";
  $("#effect-amount-value").value = Math.round(engine.effectAmount * 100) + "%";
  $("#effect-description").textContent = effectDescriptions[engine.effect];
}
document.querySelectorAll("[data-effect]").forEach((button) =>
  button.addEventListener("click", () => {
    engine.setEffect(button.dataset.effect);
    engine.setBypass(false);
    refresh();
    status("エフェクター：" + button.querySelector("b").textContent);
  }),
);
$("#effect-amount").addEventListener("input", (e) => {
  engine.setEffect(engine.effect, Number(e.target.value));
  refreshEffects();
});
const soundStorageKey = "acousmonium-sound-library-v1";
let savedSounds = [];
function saveStatus(message) {
  $("#save-status").textContent = message;
}
function captureSound() {
  const values = { ...engine.values };
  values.angle = Math.round(
    ((((values.angle + engine.angleOffset + 180) % 360) + 360) % 360) - 180,
  );
  return {
    values,
    effect: engine.effect,
    amount: engine.effectAmount,
    reverse: engine.reverse,
    loop: engine.loop,
    bypass: engine.bypass,
  };
}
// Validate imported and stored data against the actual controls, before changing sound.
function validSound(item) {
  if (
    !item ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    item.name.length > 40 ||
    !item.sound
  )
    return false;
  const s = item.sound;
  if (
    !Object.hasOwn(effectDescriptions, s.effect) ||
    !Number.isFinite(s.amount) ||
    s.amount < 0 ||
    s.amount > 1 ||
    !s.values
  )
    return false;
  if (!["reverse", "loop", "bypass"].every((k) => typeof s[k] === "boolean"))
    return false;
  return sliders.every(
    (input) =>
      Number.isFinite(s.values[input.id]) &&
      s.values[input.id] >= Number(input.min) &&
      s.values[input.id] <= Number(input.max),
  );
}
function cleanItem(item) {
  const values = {};
  sliders.forEach((input) => (values[input.id] = item.sound.values[input.id]));
  return {
    name: item.name.trim(),
    sound: {
      values,
      effect: item.sound.effect,
      amount: item.sound.amount,
      reverse: item.sound.reverse,
      loop: item.sound.loop,
      bypass: item.sound.bypass,
    },
  };
}
function persist(message) {
  try {
    localStorage.setItem(
      soundStorageKey,
      JSON.stringify({ version: 1, items: savedSounds }),
    );
    saveStatus(message);
  } catch {
    saveStatus(
      message +
        " ブラウザーへの保存ができないため、この画面を閉じる前に「設定を書き出す」で保存してください。",
    );
  }
  renderSounds();
}
function loadSound(item) {
  Object.entries(item.sound.values).forEach(([key, value]) =>
    engine.set(key, value),
  );
  engine.setEffect(item.sound.effect, item.sound.amount);
  engine.setLoop(item.sound.loop);
  engine.setReverse(item.sound.reverse);
  engine.setBypass(item.sound.bypass);
  document
    .querySelectorAll("[data-preset]")
    .forEach((b) => b.setAttribute("aria-pressed", "false"));
  refresh();
  drawWave();
  saveStatus("「" + item.name + "」を呼び出しました。");
  status("マイ設定：" + item.name);
}
function renderSounds() {
  const list = $("#saved-sounds");
  list.replaceChildren();
  if (!savedSounds.length) {
    const li = document.createElement("li");
    li.className = "saved-empty";
    li.textContent =
      "まだ保存した設定はありません。気に入った聴こえ方に名前を付けてみましょう。";
    list.append(li);
  }
  savedSounds.forEach((item, index) => {
    const li = document.createElement("li"),
      title = document.createElement("strong"),
      meta = document.createElement("small"),
      actions = document.createElement("div");
    title.textContent = item.name;
    meta.textContent =
      {
        none: "加工なし",
        crush: "ガビガビ",
        radio: "ラジオ",
        robot: "ロボット",
        tremolo: "トレモロ",
      }[item.sound.effect] +
      " · 距離 " +
      item.sound.values.distance +
      "m · 残響 " +
      item.sound.values.reverb;
    li.append(title, meta);
    [
      ["呼び出す", () => loadSound(item)],
      [
        "上書き",
        () => {
          savedSounds[index] = { name: item.name, sound: captureSound() };
          persist("「" + item.name + "」を現在の設定で上書きしました。");
        },
      ],
      [
        "削除",
        () => {
          savedSounds.splice(index, 1);
          persist("「" + item.name + "」を削除しました。");
        },
      ],
    ].forEach(([label, handler]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.setAttribute("aria-label", item.name + "を" + label);
      b.addEventListener("click", handler);
      actions.append(b);
    });
    li.append(actions);
    list.append(li);
  });
  $("#export-sounds").disabled = !savedSounds.length;
}
$("#save-sound").addEventListener("click", () => {
  if (savedSounds.length >= 12) {
    saveStatus(
      "保存は12件までです。不要な設定を削除するか、既存の設定を上書きしてください。",
    );
    return;
  }
  const name =
    $("#sound-name").value.trim() || "マイ設定 " + (savedSounds.length + 1);
  if (savedSounds.some((item) => item.name === name)) {
    saveStatus(
      "同じ名前があります。名前を変えるか、その設定の「上書き」を押してください。",
    );
    return;
  }
  savedSounds.push({ name, sound: captureSound() });
  $("#sound-name").value = "";
  persist("「" + name + "」を保存しました。");
});
$("#sound-name").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#save-sound").click();
  }
});
$("#export-sounds").addEventListener("click", () => {
  const blob = new Blob(
      [
        JSON.stringify(
          { format: "acousmonium-sounds", version: 1, items: savedSounds },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "acousmonium-sounds.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  saveStatus("設定ファイルを書き出しました。別のブラウザーでも読み込めます。");
});
$("#import-sounds").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 100000)
      throw Error("設定ファイルは100KB以内で選んでください。");
    const data = JSON.parse(await file.text());
    if (
      data.format !== "acousmonium-sounds" ||
      data.version !== 1 ||
      !Array.isArray(data.items) ||
      !data.items.length ||
      data.items.length > 12 ||
      !data.items.every(validSound)
    )
      throw Error(
        "対応する設定ファイルではありません。ラボから書き出したJSONを選んでください。",
      );
    if (savedSounds.length + data.items.length > 12)
      throw Error(
        "読み込み後に12件を超えます。先に不要な設定を整理してください。",
      );
    for (const source of data.items) {
      const item = cleanItem(source),
        original = item.name;
      let n = 2;
      while (savedSounds.some((x) => x.name === item.name))
        item.name = original.slice(0, 32) + " (" + n++ + ")";
      savedSounds.push(item);
    }
    persist(data.items.length + "件の設定を追加しました。");
  } catch (error) {
    saveStatus(error.message || "設定を読み込めませんでした。");
  } finally {
    e.target.value = "";
  }
});
try {
  const data = JSON.parse(localStorage.getItem(soundStorageKey) || "null");
  if (
    data &&
    data.version === 1 &&
    Array.isArray(data.items) &&
    data.items.length <= 12 &&
    data.items.every(validSound)
  )
    savedSounds = data.items.map(cleanItem);
  else if (data)
    saveStatus(
      "保存データを読み込めませんでした。書き出した設定ファイルがあれば読み込んでください。",
    );
} catch {
  saveStatus(
    "ブラウザー内の保存機能を利用できません。設定はJSONファイルに書き出せます。",
  );
}
refreshEffects();
renderSounds();
