// App(t) = UI の土台。シーンを登録し、プレビュー用の再生バーと時刻計算の道具を提供する。
// file:// で開いても動くよう、ES module ではなく通常の script として window.Anim を公開する。
(function () {
  "use strict";

  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, p) => a + (b - a) * p;

  const ease = {
    linear: (p) => p,
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    out: (p) => 1 - Math.pow(1 - p, 3),
    in: (p) => p * p * p,
    back: (p) => {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
    },
  };

  // start から dur 秒かけて 0→1 に進む値。start 前は 0、終了後は 1 で止まる。
  function progress(t, start, dur, easing = ease.inOut) {
    if (dur <= 0) return t >= start ? 1 : 0;
    return easing(clamp((t - start) / dur));
  }

  // 出て、留まり、消える値。字幕や強調の明滅に使う。
  function pulse(t, start, end, fade = 0.3) {
    return Math.min(progress(t, start, fade), 1 - progress(t, end - fade, fade));
  }

  // 1 秒あたり cps 文字で打たれていく文字列。
  function typed(text, t, start, cps = 12) {
    const chars = Array.from(text);
    return chars.slice(0, Math.floor(clamp((t - start) * cps, 0, chars.length))).join("");
  }

  // 場面を順に並べ、名前から開始時刻と長さを引けるようにする。
  // timeline([{ name: "intro", dur: 2 }, { name: "request", dur: 4, gap: 0.5 }])
  function timeline(scenes) {
    let cursor = 0;
    const byName = {};
    const list = scenes.map((scene) => {
      cursor += scene.gap ?? 0;
      const entry = { ...scene, start: cursor, end: cursor + scene.dur };
      if (byName[scene.name])
        throw new Error(`timeline の場面名が重複しています: ${scene.name}`);
      byName[scene.name] = entry;
      cursor = entry.end;
      return entry;
    });
    const get = (name) => {
      const scene = byName[name];
      if (!scene) throw new Error(`timeline に場面がありません: ${name}`);
      return scene;
    };
    return {
      duration: cursor,
      scenes: list,
      start: (name) => get(name).start,
      end: (name) => get(name).end,
      // 場面内の進み具合（0→1）。offset と dur で場面の一部だけを使える。
      p: (name, t, { offset = 0, dur, easing } = {}) => {
        const scene = get(name);
        return progress(t, scene.start + offset, dur ?? scene.dur - offset, easing);
      },
      at: (t) =>
        list.find((scene) => t >= scene.start && t < scene.end) ?? list[list.length - 1],
    };
  }

  // 字幕。cues は [{ at, until, text }]。重なった場合は後のものを優先する。
  function caption(el, t, cues, fade = 0.25) {
    let shown = null;
    for (const cue of cues) if (t >= cue.at && t < cue.until) shown = cue;
    if (!shown) {
      el.style.opacity = 0;
      return;
    }
    if (el.textContent !== shown.text) el.textContent = shown.text;
    el.style.opacity = pulse(t, shown.at, shown.until, fade);
  }

  // Tailwind の CDN 版はクラスの変化を検知してから CSS を作るため、2 フレーム待ってスタイルの反映を確実にする。
  function settle() {
    return new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  }

  // シーンを登録する。setup は一度だけ（フォント読み込み後に）呼ばれ、render(t) は毎コマ呼ばれる。
  function define({
    width = 1920,
    height = 1080,
    duration,
    fps = 30,
    setup,
    render,
    inspect,
  }) {
    if (!(duration > 0)) throw new Error("Anim.define には正の duration（秒）が必要です");
    const capture = new URLSearchParams(location.search).has("capture");
    const anim = { width, height, duration, fps, capture, inspect: inspect ?? null };
    anim.ready = document.fonts.ready.then(async () => {
      if (setup) await setup();
      render(0);
      await settle();
      if (!capture) mountPlayer(anim);
    });
    anim.render = (t) => render(clamp(t, 0, duration));
    anim.settle = settle;
    window.ANIM = anim;
    return anim;
  }

  // プレビュー専用の再生バー。撮影時（?capture=1）は作らない。
  function mountPlayer(anim) {
    const stage = document.getElementById("stage");
    document.body.classList.add("preview");
    const bar = document.createElement("div");
    bar.className = "player";
    bar.innerHTML =
      '<button type="button" aria-label="再生">▶</button>' +
      `<input type="range" min="0" max="${anim.duration}" step="${1 / anim.fps}" value="0" aria-label="時刻">` +
      "<output>0.00s</output>";
    document.body.appendChild(bar);
    const [button, range, out] = bar.children;

    let t = 0;
    let playing = false;
    let last = 0;
    const show = (next) => {
      t = clamp(next, 0, anim.duration);
      anim.render(t);
      range.value = t;
      out.textContent = `${t.toFixed(2)}s / ${anim.duration.toFixed(2)}s`;
    };
    const tick = (now) => {
      if (!playing) return;
      show(t + (now - last) / 1000);
      last = now;
      if (t >= anim.duration) setPlaying(false);
      else requestAnimationFrame(tick);
    };
    const setPlaying = (on) => {
      playing = on;
      button.textContent = on ? "❚❚" : "▶";
      if (on) {
        if (t >= anim.duration) t = 0;
        last = performance.now();
        requestAnimationFrame(tick);
      }
    };
    button.addEventListener("click", () => setPlaying(!playing));
    range.addEventListener("input", () => {
      setPlaying(false);
      show(Number(range.value));
    });
    addEventListener("keydown", (e) => {
      if (e.key === " ") {
        e.preventDefault();
        setPlaying(!playing);
      }
      if (e.key === "ArrowRight") show(t + (e.shiftKey ? 1 : 1 / anim.fps));
      if (e.key === "ArrowLeft") show(t - (e.shiftKey ? 1 : 1 / anim.fps));
    });

    const fit = () => {
      const scale = Math.min(innerWidth / anim.width, (innerHeight - 56) / anim.height);
      stage.style.transform = `scale(${scale})`;
      stage.parentElement.style.width = `${anim.width * scale}px`;
      stage.parentElement.style.height = `${anim.height * scale}px`;
    };
    addEventListener("resize", fit);
    fit();
    show(0);
  }

  window.Anim = { clamp, lerp, ease, progress, pulse, typed, timeline, caption, define };
})();
