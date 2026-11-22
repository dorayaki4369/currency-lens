// 構成図（箱、グループ、線、線上を流れる粒）を SVG に描く部品。
// 定義した箱と線だけを描き、存在しない箱や線を参照したら例外にして、元の図のトポロジーから外れないようにする。
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs = {}, parent) => {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (parent) parent.appendChild(node);
    return node;
  };

  const NODE_DEFAULTS = { minW: 200, h: 96, padX: 32, lineHeight: 34, fontSize: 26 };
  const GROUP_PAD = 36;
  // 見出し（上）と字幕（下）を避けた、図を収める既定の領域。
  const FIT_DEFAULTS = { x: 80, y: 210, w: 1760, h: 620, maxScale: 1.8 };

  function create(svg, spec) {
    const nodes = new Map();
    const groups = new Map();
    const edges = new Map();
    const opts = { ...NODE_DEFAULTS, ...spec.options };

    svg.setAttribute("font-size", opts.fontSize);
    const defs = el("defs", {}, svg);
    for (const [id, cls] of [
      ["arrow", "edge-head"],
      ["arrow-glow", "edge-head glow"],
    ]) {
      const marker = el(
        "marker",
        {
          id: `${svg.id || "d"}-${id}`,
          viewBox: "0 0 10 10",
          refX: 9,
          refY: 5,
          markerWidth: 7,
          markerHeight: 7,
          orient: "auto-start-reverse",
        },
        defs,
      );
      el("path", { d: "M0,0 L10,5 L0,10 z", class: cls }, marker);
    }
    const root = el("g", { class: "diagram-root" }, svg);
    const layers = {
      groups: el("g", { class: "layer-groups" }, root),
      edges: el("g", { class: "layer-edges" }, root),
      nodes: el("g", { class: "layer-nodes" }, root),
      packets: el("g", { class: "layer-packets" }, root),
    };

    for (const n of spec.nodes) {
      if (nodes.has(n.id)) throw new Error(`箱の id が重複しています: ${n.id}`);
      nodes.set(n.id, buildNode(layers.nodes, n, opts));
    }
    for (const g of spec.groups ?? []) {
      if (groups.has(g.id) || nodes.has(g.id))
        throw new Error(`グループの id が重複しています: ${g.id}`);
      for (const id of g.nodes)
        if (!nodes.has(id))
          throw new Error(`グループ ${g.id} に未定義の箱があります: ${id}`);
      groups.set(g.id, buildGroup(layers.groups, g, nodes));
    }
    for (const e of spec.edges ?? []) {
      for (const end of [e.from, e.to])
        if (!nodes.has(end))
          throw new Error(`線 ${e.from}->${e.to} の端が未定義の箱です: ${end}`);
      const key = e.id ?? `${e.from}->${e.to}`;
      if (edges.has(key))
        throw new Error(
          `線が重複しています: ${key}。同じ箱の間に複数の線がある場合は id を付けてください。`,
        );
      edges.set(key, buildEdge(layers.edges, svg, e, nodes));
    }
    warnOverlaps(nodes);
    const view = fitToRegion(root, nodes, groups, spec.fit);
    if (opts.fontSize * view.scale < 22) {
      console.warn(
        `拡大後の箱の文字が ${Math.round(opts.fontSize * view.scale)}px と小さくなっています。箱の間隔を詰めるか、横長の図なら縦に折り返す配置を検討してください。`,
      );
    }

    const visibleDefault = spec.initiallyHidden ? 0 : 1;

    function render(state = {}) {
      const defaults = { show: visibleDefault, ...state.defaults };
      assertKnown(state.nodes, nodes, "箱");
      assertKnown(state.groups, groups, "グループ");
      assertKnown(state.edges, edges, "線");

      for (const [id, g] of groups) paintBox(g, { ...defaults, ...state.groups?.[id] });
      for (const [id, n] of nodes) paintBox(n, { ...defaults, ...state.nodes?.[id] });
      for (const [key, e] of edges) paintEdge(e, { ...defaults, ...state.edges?.[key] });

      layers.packets.replaceChildren();
      for (const packet of state.packets ?? []) {
        const e = edges.get(packet.edge);
        if (!e) throw new Error(`粒が未定義の線を通ろうとしています: ${packet.edge}`);
        drawPacket(layers.packets, e, packet);
      }
    }

    return {
      render,
      edgeKeys: () => [...edges.keys()],
      // 箱の中心と大きさを、拡大後の舞台座標で返す。吹き出しや注釈を HTML で重ねるときに使う。
      center: (id) => {
        const n = nodes.get(id) ?? groups.get(id);
        if (!n) throw new Error(`未定義の箱です: ${id}`);
        return {
          x: view.x + n.x * view.scale,
          y: view.y + n.y * view.scale,
          w: n.w * view.scale,
          h: n.h * view.scale,
        };
      },
      scale: () => view.scale,
      inspect: () => ({
        nodes: spec.nodes.map((n) => ({ id: n.id, label: n.label })),
        groups: (spec.groups ?? []).map((g) => ({
          id: g.id,
          label: g.label,
          nodes: g.nodes,
        })),
        edges: (spec.edges ?? []).map((e) => ({
          id: e.id ?? `${e.from}->${e.to}`,
          from: e.from,
          to: e.to,
          label: e.label ?? null,
          dashed: !!e.dashed,
          arrow: e.arrow ?? "end",
        })),
      }),
    };
  }

  // SPEC の座標のまま描いた図を、見出しと字幕の間の領域いっぱいに拡大して中央に置く。
  // 座標を手で詰めなくても舞台を広く使え、文字も拡大に合わせて大きくなる。fit: false で無効にする。
  function fitToRegion(root, nodes, groups, fit) {
    if (fit === false) return { x: 0, y: 0, scale: 1 };
    const region = { ...FIT_DEFAULTS, ...fit };
    for (const item of [...groups.values(), ...nodes.values()]) paintBox(item, {});
    const box = root.getBBox();
    const scale = Math.min(region.w / box.width, region.h / box.height, region.maxScale);
    const x = region.x + (region.w - box.width * scale) / 2 - box.x * scale;
    const y = region.y + (region.h - box.height * scale) / 2 - box.y * scale;
    root.setAttribute("transform", `translate(${x},${y}) scale(${scale})`);
    return { x, y, scale };
  }

  function buildNode(layer, n, opts) {
    const g = el("g", { class: `node kind-${n.kind ?? "box"}`, "data-id": n.id }, layer);
    const lines = String(n.label).split("\n");
    const text = el("text", { "text-anchor": "middle", "dominant-baseline": "central" }, g);
    lines.forEach((line, i) => {
      const tspan = el(
        "tspan",
        {
          x: 0,
          dy: i === 0 ? -((lines.length - 1) * opts.lineHeight) / 2 : opts.lineHeight,
        },
        text,
      );
      tspan.textContent = line;
    });
    if (n.sub) {
      const sub = el(
        "text",
        {
          class: "node-sub",
          "text-anchor": "middle",
          y: (lines.length * opts.lineHeight) / 2 + 14,
        },
        g,
      );
      sub.textContent = n.sub;
    }
    const textW = text.getBBox().width;
    const w = n.w ?? Math.max(opts.minW, Math.ceil(textW + opts.padX * 2));
    const h =
      n.h ?? Math.max(opts.h, lines.length * opts.lineHeight + 40 + (n.sub ? 30 : 0));
    if (textW > w - 16)
      console.warn(
        `箱「${n.label}」のラベルが幅 ${w}px に収まりません。w を広げるか改行してください。`,
      );
    const shape = buildShape(n.kind ?? "box", w, h);
    g.insertBefore(shape, text);
    if (n.sub) text.setAttribute("transform", "translate(0,-12)");
    return { ...n, w, h, g, shape };
  }

  function buildShape(kind, w, h) {
    if (kind === "db") {
      const ry = Math.min(18, h / 6);
      const g = el("g", { class: "shape" });
      el(
        "path",
        {
          d: `M${-w / 2},${-h / 2 + ry} A${w / 2},${ry} 0 0 0 ${w / 2},${-h / 2 + ry} V${h / 2 - ry} A${w / 2},${ry} 0 0 1 ${-w / 2},${h / 2 - ry} Z`,
        },
        g,
      );
      el("ellipse", { cx: 0, cy: -h / 2 + ry, rx: w / 2, ry }, g);
      return g;
    }
    const r = kind === "pill" ? h / 2 : 14;
    return el("rect", {
      class: "shape",
      x: -w / 2,
      y: -h / 2,
      width: w,
      height: h,
      rx: r,
      ry: r,
    });
  }

  function buildGroup(layer, g, nodes) {
    const members = g.nodes.map((id) => nodes.get(id));
    const pad = g.pad ?? GROUP_PAD;
    const left = Math.min(...members.map((n) => n.x - n.w / 2)) - pad;
    const right = Math.max(...members.map((n) => n.x + n.w / 2)) + pad;
    const top = Math.min(...members.map((n) => n.y - n.h / 2)) - pad - 34;
    const bottom = Math.max(...members.map((n) => n.y + n.h / 2)) + pad;
    const w = right - left;
    const h = bottom - top;
    const x = left + w / 2;
    const y = top + h / 2;
    const node = el("g", { class: "group", "data-id": g.id }, layer);
    const shape = el(
      "rect",
      { class: "shape", x: -w / 2, y: -h / 2, width: w, height: h, rx: 18, ry: 18 },
      node,
    );
    const label = el(
      "text",
      { class: "group-label", x: -w / 2 + 20, y: -h / 2 + 30 },
      node,
    );
    label.textContent = g.label;
    return { ...g, x, y, w, h, g: node, shape };
  }

  function buildEdge(layer, svg, e, nodes) {
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    const points = routePoints(a, b, e.bend);
    const g = el(
      "g",
      {
        class: `edge${e.dashed ? " dashed" : ""}`,
        "data-id": e.id ?? `${e.from}->${e.to}`,
      },
      layer,
    );
    const path = el(
      "path",
      { d: points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ") },
      g,
    );
    const length = path.getTotalLength();
    let label = null;
    if (e.label) {
      const mid = path.getPointAtLength(length / 2);
      label = el(
        "g",
        { class: "edge-label", transform: `translate(${mid.x},${mid.y})` },
        g,
      );
      const bg = el("rect", {}, label);
      const text = el(
        "text",
        { "text-anchor": "middle", "dominant-baseline": "central" },
        label,
      );
      text.textContent = e.label;
      const box = text.getBBox();
      Object.entries({
        x: box.x - 10,
        y: box.y - 4,
        width: box.width + 20,
        height: box.height + 8,
        rx: 8,
      }).forEach(([k, v]) => bg.setAttribute(k, v));
    }
    return { ...e, g, path, length, label, markerId: svg.id || "d" };
  }

  // 箱の中心同士を結び、箱の縁で切る。bend: "hv" は横→縦、"vh" は縦→横に折れる。
  function routePoints(a, b, bend) {
    if (bend === "hv" || bend === "vh") {
      const corner = bend === "hv" ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
      return [clipToBox(a, corner), corner, clipToBox(b, corner)];
    }
    return [clipToBox(a, b), clipToBox(b, a)];
  }

  function clipToBox(box, toward, gap = 6) {
    const dx = toward.x - box.x;
    const dy = toward.y - box.y;
    if (dx === 0 && dy === 0) return { x: box.x, y: box.y };
    const sx = dx === 0 ? Infinity : (box.w / 2 + gap) / Math.abs(dx);
    const sy = dy === 0 ? Infinity : (box.h / 2 + gap) / Math.abs(dy);
    const s = Math.min(sx, sy);
    return { x: box.x + dx * s, y: box.y + dy * s };
  }

  function paintBox(item, s) {
    const show = s.show ?? 1;
    const scale = 0.85 + 0.15 * show;
    item.g.setAttribute("transform", `translate(${item.x},${item.y}) scale(${scale})`);
    item.g.style.opacity = show * (1 - 0.7 * (s.dim ?? 0));
    item.g.classList.toggle("glow", (s.glow ?? 0) > 0.5);
    item.g.style.setProperty("--glow", s.glow ?? 0);
  }

  // 実線は描き進め、点線は dasharray を描き進めに使えないためフェードで出す。
  function paintEdge(e, s) {
    const draw = s.draw ?? s.show ?? 1;
    const glow = (s.glow ?? 0) > 0.5;
    e.g.classList.toggle("glow", glow);
    e.g.style.opacity = (e.dashed ? draw : draw > 0 ? 1 : 0) * (1 - 0.7 * (s.dim ?? 0));
    if (!e.dashed) {
      e.path.style.strokeDasharray = `${e.length}`;
      e.path.style.strokeDashoffset = `${e.length * (1 - draw)}`;
    }
    const arrow = e.arrow ?? "end";
    const marker = `url(#${e.markerId}-${glow ? "arrow-glow" : "arrow"})`;
    const done = draw >= 0.98;
    e.path.setAttribute(
      "marker-end",
      done && (arrow === "end" || arrow === "both") ? marker : "",
    );
    e.path.setAttribute("marker-start", done && arrow === "both" ? marker : "");
    if (e.label) e.label.style.opacity = Math.max(0, (draw - 0.6) / 0.4);
  }

  // 出発前（p <= 0）と到着後（p >= 1）の粒は描かない。端に留めたい場合は hold: true を付ける。
  function drawPacket(layer, e, packet) {
    if (!packet.hold && (packet.p <= 0 || packet.p >= 1)) return;
    const p = Math.min(1, Math.max(0, packet.p));
    const at = e.path.getPointAtLength(e.length * (packet.reverse ? 1 - p : p));
    const g = el(
      "g",
      {
        class: `packet${packet.className ? ` ${packet.className}` : ""}`,
        transform: `translate(${at.x},${at.y})`,
      },
      layer,
    );
    g.style.opacity = packet.opacity ?? 1;
    el("circle", { r: packet.r ?? 11 }, g);
    if (packet.label) {
      const bg = el("rect", {}, g);
      const text = el(
        "text",
        { "text-anchor": "middle", "dominant-baseline": "central", y: -34 },
        g,
      );
      text.textContent = packet.label;
      const box = text.getBBox();
      Object.entries({
        x: box.x - 12,
        y: box.y - 6,
        width: box.width + 24,
        height: box.height + 12,
        rx: 10,
      }).forEach(([k, v]) => bg.setAttribute(k, v));
    }
  }

  function assertKnown(map, known, kind) {
    for (const key of Object.keys(map ?? {})) {
      if (!known.has(key)) throw new Error(`元の図にない${kind}を参照しています: ${key}`);
    }
  }

  function warnOverlaps(nodes) {
    const list = [...nodes.values()];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (
          Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
          Math.abs(a.y - b.y) < (a.h + b.h) / 2
        ) {
          console.warn(`箱が重なっています: ${a.id} と ${b.id}`);
        }
      }
    }
  }

  window.Diagram = { create };
})();
