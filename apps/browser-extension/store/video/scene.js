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
