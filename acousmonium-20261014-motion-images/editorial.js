"use strict";
// Shared navigation and page tools. No third-party tracking or form submission.
const pageName = location.pathname.split("/").pop() || "index.html";
const navPage =
  {
    "higaki.html": "artists.html",
    "kanno.html": "artists.html",
    "story.html": "about.html",
    "glossary.html": "about.html",
  }[pageName] || pageName;
document.querySelectorAll(".masthead nav a").forEach((link) => {
  if (link.getAttribute("href") === navPage)
    link.setAttribute("aria-current", "page");
});
const menu = document.querySelector(".mobile-menu");
menu?.addEventListener("click", (event) => {
  if (event.target.closest("a")) menu.open = false;
});

// Search the bundled index, so the downloaded site also works offline.
const dialog = document.querySelector("#site-search");
const query = document.querySelector("#search-query");
const results = document.querySelector("#search-results");
const count = document.querySelector("#search-count");
const normalize = (value) =>
  value.normalize("NFKC").toLocaleLowerCase("ja-JP").trim();
const aliases = {
  "higaki.html": "ひがき ともなり higaki tomonari",
  "kanno.html": "かんの かる kanno karu",
  "lab.html": "デモ 音声 音響 体験 リバーブ ピッチ パン",
  "organize.html": "補助金 助成金 ワークショップ 企画 資金",
  "start.html": "練習 入門 奏者 初心者",
};
function searchPages(value) {
  const words = normalize(value).split(/\s+/).filter(Boolean);
  return SITE_SEARCH_INDEX.map((item) => {
    const full = normalize(
      item.title +
        " " +
        item.description +
        " " +
        item.text +
        " " +
        (aliases[item.url] || ""),
    );
    const match = words.every((word) => full.includes(word));
    const score = words.reduce(
      (sum, word) =>
        sum +
        (normalize(item.title).includes(word) ? 8 : 0) +
        (normalize(item.description).includes(word) ? 3 : 0),
      0,
    );
    return { item, match, score };
  })
    .filter((row) => row.match)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}
function renderSearch() {
  const matched = searchPages(query.value);
  results.replaceChildren();
  count.textContent = query.value.trim()
    ? `${matched.length}ページが見つかりました`
    : "全ページから探せます";
  if (!matched.length) {
    const p = document.createElement("p");
    p.className = "search-empty";
    p.textContent =
      "見つかりませんでした。「朗読」「演奏」「助成」など、別の言葉でお試しください。";
    results.append(p);
  }
  matched.forEach((item) => {
    const a = document.createElement("a"),
      title = document.createElement("b"),
      description = document.createElement("p");
    a.href = item.url;
    title.textContent = item.title + " ↗";
    description.textContent = item.description;
    a.append(title, description);
    results.append(a);
  });
}
document.querySelectorAll(".search-trigger").forEach((button) =>
  button.addEventListener("click", () => {
    menu.open = false;
    renderSearch();
    dialog.showModal();
    query.focus();
  }),
);
document
  .querySelector("#search-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    dialog.close();
});
query.addEventListener("input", renderSearch);

// Reading progress and a sidebar that follows the current section.
const headings = [...document.querySelectorAll(".reading-body h2[id]")];
let scrollQueued = false;
function updateReading() {
  const range = document.documentElement.scrollHeight - innerHeight;
  document.querySelector("#reading-progress").style.width =
    (range > 0 ? Math.min(100, Math.max(0, (scrollY / range) * 100)) : 0) + "%";
  let active = headings[0];
  for (const heading of headings)
    if (heading.getBoundingClientRect().top <= 160) active = heading;
  document.querySelectorAll(".toc a").forEach((link) => {
    if (active && link.getAttribute("href") === "#" + active.id)
      link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
  scrollQueued = false;
}
addEventListener(
  "scroll",
  () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(updateReading);
    }
  },
  { passive: true },
);
addEventListener("resize", updateReading);
updateReading();

// Home: concise paths for three different audiences.
const paths = {
  first: {
    text: "まず短い体験から。仕組みを読むと、聴こえ方の変化がもっと面白くなります。",
    links: [
      ["lab.html", "01 朗読ラボで体験"],
      ["about.html", "02 仕組みを知る"],
      ["visit.html", "03 公演へ出かける"],
    ],
  },
  play: {
    text: "一度に一つだけ変えて、違いを聴く。練習の意図を決めたら、実機に触れる機会へ進みましょう。",
    links: [
      ["start.html", "01 最初の20分の練習"],
      ["lab.html", "02 声で試してみる"],
      ["artists.html", "03 奏者の活動を知る"],
    ],
  },
  host: {
    text: "誰に何を届けるかから始めます。体験会の構成と記録を考え、次の協力につながる企画へ。",
    links: [
      ["organize.html", "01 体験会の企画を考える"],
      ["organize.html#section-5", "02 助成制度の入口へ"],
      ["organize.html#section-6", "03 企画メモをつくる"],
    ],
  },
};
document.querySelectorAll("[data-path]").forEach((button) =>
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[data-path]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    const path = paths[button.dataset.path],
      panel = document.querySelector("#path-panel");
    panel.replaceChildren();
    const p = document.createElement("p");
    p.textContent = path.text;
    panel.append(p);
    path.links.forEach(([url, title]) => {
      const a = document.createElement("a");
      a.href = url;
      a.textContent = title + " ↗";
      panel.append(a);
    });
  }),
);

// Glossary: search as you type, using text already present in the page.
const termSearch = document.querySelector("#term-search");
termSearch?.addEventListener("input", () => {
  const words = normalize(termSearch.value).split(/\s+/).filter(Boolean);
  let visible = 0;
  document.querySelectorAll(".term").forEach((term) => {
    term.hidden = !words.every((word) =>
      normalize(term.dataset.term).includes(word),
    );
    if (!term.hidden) visible++;
  });
  document.querySelector("#term-count").textContent = visible + "語を表示";
  document.querySelector("#term-empty").hidden = visible !== 0;
});

// Practice checklist: optional local persistence; never sent to a server.
const checks = [...document.querySelectorAll("[data-check]")];
let canSave = true;
try {
  checks.forEach((input) => {
    input.checked =
      localStorage.getItem("acousmonium-check-" + input.dataset.check) === "1";
  });
} catch {
  canSave = false;
}
function updateChecks() {
  const node = document.querySelector("#check-status");
  if (node)
    node.textContent =
      checks.filter((input) => input.checked).length +
      " / " +
      checks.length +
      " 項目" +
      (canSave ? " · このブラウザーに保存" : " · この環境では保存されません");
}
checks.forEach((input) =>
  input.addEventListener("change", () => {
    try {
      localStorage.setItem(
        "acousmonium-check-" + input.dataset.check,
        input.checked ? "1" : "0",
      );
    } catch {
      canSave = false;
    }
    updateChecks();
  }),
);
updateChecks();

// A useful export rather than an unconnected contact/registration form.
const brief = document.querySelector("#project-brief");
brief?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(brief);
  const fields = [
    ["title", "企画名"],
    ["purpose", "誰に、何を届けるか"],
    ["program", "実施内容・日時・場所"],
    ["team", "体制と協力してほしいこと"],
    ["budget", "収支の前提"],
    ["outcome", "記録する成果・次の一歩"],
  ];
  const content =
    "アクースモニウム体験会 企画メモ\n\n" +
    fields
      .map(
        ([key, title]) =>
          title + "\n" + (String(data.get(key) || "").trim() || "（未記入）"),
      )
      .join("\n\n") +
    "\n\n本サイト独自の準備用メモです。助成申請書の様式ではありません。\n";
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "acousmonium-project-memo.txt";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  document.querySelector("#brief-status").textContent =
    "ダウンロードを開始しました。入力内容は送信されていません。";
});
