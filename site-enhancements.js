/* Small decorative motion and shared, editable image slots. */
(() => {
  const root = document.documentElement;
  const toggle = document.querySelector(".motion-toggle");
  const preference = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };
  let paused = false;
  try {
    paused = localStorage.getItem("acousmonium-motion-paused") === "1";
  } catch {}
  function updateMotion() {
    const off = paused || preference.matches;
    root.dataset.motion = off ? "off" : "on";
    root.dataset.pageHidden = String(document.hidden);
    if (!toggle) return;
    toggle.hidden = false;
    toggle.setAttribute("aria-pressed", String(off));
    toggle.setAttribute(
      "aria-label",
      preference.matches
        ? "端末設定により装飾の動きを停止しています"
        : off
          ? "装飾の動きを再開する"
          : "装飾の動きを止める",
    );
    toggle.title = toggle.getAttribute("aria-label");
    toggle.disabled = preference.matches;
  }
  toggle?.addEventListener("click", () => {
    paused = !paused;
    try {
      localStorage.setItem("acousmonium-motion-paused", paused ? "1" : "0");
    } catch {}
    updateMotion();
  });
  preference.addEventListener?.("change", updateMotion);
  document.addEventListener("visibilitychange", updateMotion);
  updateMotion();
  const settings = window.SITE_IMAGES || {};
  document.querySelectorAll("img[data-person]").forEach((img) => {
    const item = settings[img.dataset.person];
    if (!item || typeof item.src !== "string" || !item.src.trim()) return;
    const fallback = img.getAttribute("src"),
      fallbackAlt = img.alt;
    const caption = img.closest("figure")?.querySelector("figcaption");
    img.addEventListener("error", () => {
      // A typo in a photo path must not leave a broken-image icon in the layout.
      if (img.getAttribute("src") === fallback) return;
      img.src = fallback;
      img.alt = fallbackAlt;
      if (caption) {
        caption.textContent = "音と空間のイメージ図版";
        caption.hidden = false;
      }
    });
    img.alt = typeof item.alt === "string" ? item.alt : fallbackAlt;
    if (typeof item.position === "string")
      img.style.objectPosition = item.position;
    if (caption) {
      caption.textContent = typeof item.credit === "string" ? item.credit : "";
      caption.hidden = !caption.textContent;
    }
    img.src = item.src;
  });
})();
