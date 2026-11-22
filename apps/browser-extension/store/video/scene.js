/* global Anim */
// Currency Lens のストア掲載用の説明動画。
// 海外サイトの価格を選ぶと小さな表示ですぐ換算額が分かり、押すと換算カードが開く流れを見せる。
// render(t) は t だけから画面を決める。前のコマの状態、乱数、現在時刻を使わない。
(function () {
  "use strict";
  const { progress, pulse, timeline, caption, ease, lerp } = Anim;

  const T = timeline([
    { name: "intro", dur: 3 },
    { name: "select", dur: 3.5 },
    { name: "quick", dur: 4 },
    { name: "card", dur: 5 },
    { name: "rates", dur: 4.5 },
    { name: "counts", dur: 4.5 },
    { name: "outro", dur: 4 },
  ]);

  const CUES = [
    { at: 0.5, until: T.end("intro"), text: "海外サイトの価格、円だといくら？" },
    { at: T.start("select"), until: T.end("select"), text: "価格を選ぶだけで" },
    { at: T.start("quick"), until: T.end("quick"), text: "いつもの通貨ですぐ分かる" },
    {
      at: T.start("card"),
      until: T.end("card"),
      text: "ワンクリックで複数通貨にまとめて換算",
    },
    {
      at: T.start("rates") + 0.4,
      until: T.end("rates"),
      text: "レートの推移もグラフで確認",
    },
    {
      at: T.start("counts") + 0.4,
      until: T.end("counts"),
      text: "暗号資産や貴金属も含む185通貨に対応",
    },
  ];

  const $ = (id) => document.getElementById(id);
  /** 拡大していない状態で測った、舞台座標での各要素の位置。 */
  const box = {};

  function measure(el) {
    const stage = $("stage").getBoundingClientRect();
    const scale = stage.width / 1920;
    const r = el.getBoundingClientRect();
    return {
      left: (r.left - stage.left) / scale,
      top: (r.top - stage.top) / scale,
      width: r.width / scale,
      height: r.height / scale,
    };
  }

  /** レート画面の系列。1か月の対 USD の変化率（%）で、最後の値が凡例とタグに出る。 */
  const SERIES = [
    { code: "JPY", color: "#5b4ff5", tag: "#4f46e5", final: -0.34, wave: 0.35, phase: 0.4 },
    { code: "EUR", color: "#f59e0b", tag: "#b45309", final: 3.36, wave: 0.3, phase: 1.7 },
    { code: "GBP", color: "#14b8a6", tag: "#0f766e", final: -0.91, wave: 0.25, phase: 2.9 },
  ];
  const CHART = { width: 860, top: 20, bottom: 340, min: -1.6, max: 4 };
  const POINTS = 31;

  /** 変化率をグラフの縦位置へ写す。 */
  function chartY(value) {
    return lerp(CHART.bottom, CHART.top, (value - CHART.min) / (CHART.max - CHART.min));
  }

  /** 0 から最後の値まで、なだらかに揺れながら進む系列。乱数を使わず、毎回同じ形になる。 */
  function seriesValues({ final, wave, phase }) {
    return Array.from({ length: POINTS }, (_, i) => {
      const x = i / (POINTS - 1);
      // 大きな揺れに細かな揺れを重ね、実際のレートのような細かい上下を出す。
      const swing =
        wave * Math.sin(x * 9 + phase) + wave * 0.35 * Math.sin(x * 47 + phase * 3);
      return final * ease.inOut(x) + swing * Math.sin(Math.PI * x);
    });
  }

  function formatChange(value) {
    return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
  }

  /** レート画面の凡例、線、右端のタグを描く。 */
  function buildRatesChart() {
    const svg = $("rates-chart");
    const ns = "http://www.w3.org/2000/svg";
    const grid = [CHART.top, chartY(0), CHART.bottom];
    svg.innerHTML = grid
      .map(
        (y, i) =>
          `<line x1="0" x2="${CHART.width}" y1="${y}" y2="${y}" stroke="${i === 1 ? "#94a3b8" : "#e2e8f0"}" stroke-width="2" ${i === 1 ? "" : 'stroke-dasharray="6 6"'}/>`,
      )
      .join("");
    $("rates-legend").innerHTML = SERIES.map(
      (s) => `<div>
        <p class="flex items-center gap-2 text-[22px] font-semibold"><span class="h-[5px] w-6 rounded-full" style="background:${s.color}"></span>${s.code}</p>
        <p class="mt-1 text-[34px] font-bold ${s.final >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}">${s.final >= 0 ? "↑" : "↓"} <span class="text-slate-900">${formatChange(s.final)}</span></p>
      </div>`,
    ).join("");
    // タグは値の位置に置き、重なる場合だけ上下へ離す。
    const TAG_HEIGHT = 40;
    const tagY = new Map();
    let previous = -Infinity;
    for (const s of [...SERIES].sort((a, b) => b.final - a.final)) {
      const y = Math.max(chartY(s.final), previous + TAG_HEIGHT + 6);
      tagY.set(s.code, y);
      previous = y;
    }
    for (const s of SERIES) {
      const values = seriesValues(s);
      const path = document.createElementNS(ns, "path");
      path.setAttribute(
        "d",
        values
          .map(
            (v, i) =>
              `${i === 0 ? "M" : "L"}${((i / (POINTS - 1)) * CHART.width).toFixed(1)} ${chartY(v).toFixed(1)}`,
          )
          .join(" "),
      );
      path.setAttribute("stroke", s.color);
      path.setAttribute("stroke-width", "5");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("pathLength", "1");
      path.setAttribute("stroke-dasharray", "1 1");
      path.classList.add("rate-line");
      svg.append(path);
      const tag = document.createElementNS(ns, "g");
      tag.classList.add("rate-tag");
      tag.innerHTML = `<rect x="${CHART.width + 16}" y="${tagY.get(s.code) - 20}" width="150" height="${TAG_HEIGHT}" rx="6" fill="${s.tag}"/>
        <text x="${CHART.width + 91}" y="${tagY.get(s.code) + 9}" text-anchor="middle" fill="#fff" font-size="24" font-weight="700">${formatChange(s.final)}</text>`;
      svg.append(tag);
    }
  }

  /** 2 点の間を、緩急を付けて p（0→1）で移動した座標。 */
  function between(a, b, p) {
    return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) };
  }

  Anim.define({
    duration: T.duration,
    setup() {
      box.price = measure($("price"));
      const quickTop = box.price.top + box.price.height + 16;
      $("quick").style.left = `${box.price.left}px`;
      $("quick").style.top = `${quickTop}px`;
      box.quick = measure($("quick"));
      $("card").style.left = `${box.price.left}px`;
      $("card").style.top = `${quickTop}px`;
      box.card = measure($("card"));
      buildRatesChart();
    },
    render(t) {
      caption($("caption"), t, CUES);

      // 導入: 商品ページのウィンドウが下から現れる。
      const enter = progress(t, 0.2, 0.9, ease.out);
      $("window").style.opacity = enter;
      $("window").style.transform = `translateY(${lerp(40, 0, enter)}px)`;

      // 選択: カーソルが価格の左端から右端までドラッグし、選択範囲が伸びる。
      const priceLeft = { x: box.price.left - 6, y: box.price.top + box.price.height / 2 };
      const priceRight = { x: box.price.left + box.price.width + 6, y: priceLeft.y };
      const chevron = {
        x: box.quick.left + box.quick.width - 34,
        y: box.quick.top + box.quick.height / 2,
      };
      const rest = { x: 1560, y: 860 };
      const approach = T.p("select", t, { offset: 0, dur: 1.2, easing: ease.inOut });
      const drag = T.p("select", t, { offset: 1.5, dur: 1.4, easing: ease.inOut });
      const toChip = T.p("quick", t, { offset: 2.2, dur: 1.2, easing: ease.inOut });
      const away = T.p("card", t, { offset: 1.2, dur: 1.2, easing: ease.inOut });
      let cursor = between(rest, priceLeft, approach);
      if (drag > 0) cursor = between(priceLeft, priceRight, drag);
      if (toChip > 0) cursor = between(priceRight, chevron, toChip);
      if (t >= T.start("card")) cursor = between(chevron, rest, away);
      $("cursor").style.transform = `translate(${cursor.x - 8}px, ${cursor.y - 4}px)`;
      $("cursor").style.opacity =
        progress(t, T.start("select"), 0.4) *
        (1 - progress(t, T.start("outro") - 0.6, 0.5));
      $("selection").style.transform = `scaleX(${drag})`;

      // 小さな表示: 選択が終わると、選択のすぐ下に換算額が出る。
      const quickIn = T.p("quick", t, { offset: 0.1, dur: 0.5, easing: ease.back });
      const quickOut = progress(t, T.start("card") + 0.15, 0.25);
      $("quick").style.opacity = quickIn * (1 - quickOut);
      $("quick").style.transform = `translateY(${lerp(-10, 0, quickIn)}px) scale(${
        t >= T.start("card") && t < T.start("card") + 0.15 ? 0.96 : 1
      })`;
      $("quick").style.transformOrigin = "left top";

      // 押す: 小さな表示の右端で波紋が広がり、換算カードが開く。
      const click = T.start("card");
      const ripple = progress(t, click, 0.5, ease.out);
      $("ripple").style.opacity = pulse(t, click, click + 0.5, 0.2) * (1 - ripple);
      $("ripple").style.transform =
        `translate(${chevron.x - 45}px, ${chevron.y - 45}px) scale(${lerp(0.3, 1, ripple)})`;
      const cardIn = T.p("card", t, { offset: 0.2, dur: 0.5, easing: ease.out });
      $("card").style.opacity = cardIn;
      $("card").style.transform = `translateY(${lerp(-12, 0, cardIn)}px)`;

      // カメラ: 小さな表示に寄り、カードが開いたら全体が見える位置まで引いて上へずらす。
      const zoomIn = T.p("quick", t, { offset: 0.3, dur: 1.2, easing: ease.inOut });
      const zoomOut = T.p("card", t, { offset: 0.3, dur: 1.2, easing: ease.inOut });
      const focus = { x: box.quick.left + box.quick.width / 2, y: box.quick.top };
      const near = zoomIn * (1 - zoomOut);
      const scale = lerp(1, 1.45, near);
      const lift = lerp(0, -230, zoomOut);
      // 寄っている間は、小さな表示を画面の中央付近へ動かす。
      const shown = { x: lerp(focus.x, 960, near), y: lerp(focus.y, 470, near) };
      const tx = shown.x - focus.x * scale;
      const ty = shown.y - focus.y * scale + lift;
      $("camera").style.transformOrigin = "0 0";
      $("camera").style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;

      // レートの推移: グラフの画面に切り替わり、各通貨の線が左から伸びて右端にタグが出る。
      const ratesIn = T.p("rates", t, { offset: 0, dur: 0.5, easing: ease.out });
      $("rates").style.opacity = ratesIn;
      $("rates-card").style.transform = `translateY(${lerp(30, 0, ratesIn)}px)`;
      const draw = T.p("rates", t, { offset: 0.5, dur: 1.8, easing: ease.inOut });
      document.querySelectorAll("#rates-chart .rate-line").forEach((line) => {
        line.style.strokeDashoffset = String(1 - draw);
      });
      const tags = T.p("rates", t, { offset: 2.1, dur: 0.4, easing: ease.out });
      document.querySelectorAll("#rates-chart .rate-tag").forEach((tag) => {
        tag.style.opacity = tags;
      });

      // 対応通貨数: 種類ごとの数が上から順に現れ、0 から数え上がる。
      const countsIn = T.p("counts", t, { offset: 0, dur: 0.5, easing: ease.out });
      $("counts").style.opacity = countsIn;
      document.querySelectorAll("#counts .count").forEach((row, i) => {
        const appear = T.p("counts", t, {
          offset: 0.3 + i * 0.35,
          dur: 0.5,
          easing: ease.out,
        });
        row.style.opacity = appear;
        row.style.transform = `translateY(${lerp(30, 0, appear)}px)`;
        const number = row.querySelector("[data-count]");
        const total = Number(number.dataset.count);
        const up = T.p("counts", t, { offset: 0.3 + i * 0.35, dur: 1.1, easing: ease.out });
        number.textContent = String(Math.round(total * up));
      });

      // 締め: ブランドの青でアイコンと名前を出す。
      const outro = T.p("outro", t, { offset: 0, dur: 0.7, easing: ease.out });
      $("outro").style.opacity = outro;
      $("outro").firstElementChild.style.transform = `scale(${lerp(0.92, 1, outro)})`;
    },
    inspect() {
      return { scenes: T.scenes };
    },
  });
})();
