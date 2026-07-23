// Animated "data journey" scene for the How-it-works page.
//
// Replaces five repeated static Mermaid flowcharts with one stepped animation
// showing a single USDC transfer travelling:
//   Ethereum node -> Generator -> Host -> App
// with ShinzoHub coordinating on the side. Each stage lights up the component
// currently handling the data and moves a "data packet" along the path.
//
// Exported mount() is invoked by /js/anim-runner.js.

var VIEWBOX_W = 820;
var VIEWBOX_H = 360;

// Node geometry: top-left x/y plus width/height, and a label (1-2 lines).
var NODES = {
  eth:    { x: 30,  y: 165, w: 160, h: 70, label: ['Ethereum', 'Node'] },
  gen:    { x: 250, y: 175, w: 160, h: 70, label: ['Generator', 'client'] },
  host:   { x: 435, y: 175, w: 150, h: 70, label: ['Shinzo Host'] },
  app:    { x: 620, y: 175, w: 140, h: 70, label: ['Your App'] },
  shinzo: { x: 325, y: 20,  w: 170, h: 50, label: ['ShinzoHub'] },
};
function center(n) { return { x: n.x + n.w / 2, y: n.y + n.h / 2 }; }

// P2P subgraph box that wraps Generator / Host / App.
var SUB = { x: 200, y: 95, w: 600, h: 245 };

// Edges: endpoints, whether they carry an arrowhead, and an optional label.
var EDGES = {
  e0: { p: [{ x: 190, y: 200 }, { x: 250, y: 210 }], arrow: true },                 // eth -> gen
  e1: { p: [{ x: 410, y: 210 }, { x: 435, y: 210 }], arrow: true },                 // gen -> host
  e2: { p: [{ x: 585, y: 210 }, { x: 620, y: 210 }], arrow: true,                   // host -> app (View)
        label: 'View', labelAt: { x: 602, y: 198 } },
  ed: { p: [{ x: 410, y: 70 },  { x: 410, y: 95 }],  arrow: false, dashed: true },  // shinzo -> subgraph
};

// Where the data packet sits at each stage.
var PACKET_POS = [
  center(NODES.eth),   // 0
  center(NODES.gen),   // 1
  center(NODES.host),  // 2
  { x: 602, y: 210 },  // 3 (midway along the Host -> App "View" edge)
  center(NODES.app),   // 4
];

// Each stage: which element lights up at rest, which edge the packet travels
// to get here, and the caption shown below the figure.
var STAGES = [
  { highlight: { node: 'eth'  }, transit: null,  caption: 'A block arrives at a validator. An Ethereum node already has the data.' },
  { highlight: { node: 'gen'  }, transit: 'e0',  caption: 'The Generator structures and signs it. Raw data becomes signed documents in DefraDB.' },
  { highlight: { node: 'host' }, transit: 'e1',  caption: 'Hosts pick it up over P2P. They verify the signature and update the attestation record.' },
  { highlight: { edge: 'e2'   }, transit: 'e2',  caption: 'A View transforms primitives. A WASM Lens turns raw logs into a TokenTransfer.' },
  { highlight: { node: 'app'  }, transit: 'e2',  caption: 'The app queries locally. Data is pushed over P2P and read with GraphQL from its embedded DefraDB.' },
];

// Brand palette per theme. Mirrors the light/dark Mermaid themeVariables in
// macros/mermaid.html; #ffa94d is the same "active" highlight Mermaid uses.
function palette(dark) {
  return dark
    ? { nodeFill: '#3a2326', nodeStroke: '#e0323a', nodeText: '#e8e8e8',
        edge: '#e8e8e8', subStroke: '#3a3a3a', subFill: '#222222', subText: '#b8b8b8',
        active: '#ffa94d', activeStroke: '#1e1e1e', activeText: '#1e1e1e',
        packet: '#ffa94d', packetStroke: '#1e1e1e' }
    : { nodeFill: '#ffe9e9', nodeStroke: '#d01f27', nodeText: '#353535',
        edge: '#353535', subStroke: '#c7c7c7', subFill: '#fafafa', subText: '#777777',
        active: '#ffa94d', activeStroke: '#1e1e1e', activeText: '#1e1e1e',
        packet: '#ffa94d', packetStroke: '#1e1e1e' };
}

export function mount(container, opts) {
  var d3 = opts.d3;
  var onStageChange = opts.onStageChange;
  var reducedMotion = !!opts.reducedMotion;

  var pal = palette(opts.isDark());
  var current = 0;
  var playToken = 0;
  var destroyed = false;

  container.innerHTML = '';
  container.classList.add('anim-container');

  // Caption (HTML below the SVG, so it wraps and inherits theme text color).
  var captionEl = document.createElement('div');
  captionEl.className = 'anim-caption';
  captionEl.setAttribute('role', 'status');
  container.appendChild(captionEl);

  var svg = d3.create('svg')
    .attr('viewBox', '0 0 ' + VIEWBOX_W + ' ' + VIEWBOX_H)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'img')
    .attr('aria-label', 'Animated data flow: Ethereum node to Generator to Host to app, with ShinzoHub coordinating.');
  container.appendChild(svg.node());

  var defs = svg.append('defs');
  ['arrow', 'arrow-active'].forEach(function (id) {
    defs.append('marker')
      .attr('id', id)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9).attr('refY', 5)
      .attr('markerWidth', 7).attr('markerHeight', 7)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', id === 'arrow-active' ? pal.active : pal.edge);
  });

  var root = svg.append('g');

  // P2P subgraph box.
  root.append('rect')
    .attr('class', 'subgraph')
    .attr('x', SUB.x).attr('y', SUB.y)
    .attr('width', SUB.w).attr('height', SUB.h)
    .attr('rx', 8)
    .attr('fill', pal.subFill)
    .attr('stroke', pal.subStroke)
    .attr('stroke-dasharray', '5 5');
  root.append('text')
    .attr('class', 'subgraph-label')
    .attr('x', SUB.x + 12).attr('y', SUB.y + 20)
    .attr('fill', pal.subText)
    .attr('font-family', 'Geist, sans-serif')
    .attr('font-size', 13)
    .text('P2P Network (DefraDB)');

  // Edges (+ optional labels).
  var edgeSel = {};
  Object.keys(EDGES).forEach(function (id) {
    var e = EDGES[id];
    var line = root.append('line')
      .attr('class', 'edge')
      .attr('x1', e.p[0].x).attr('y1', e.p[0].y)
      .attr('x2', e.p[1].x).attr('y2', e.p[1].y)
      .attr('stroke', pal.edge)
      .attr('stroke-width', 1.5)
      .attr('marker-end', e.arrow ? 'url(#arrow)' : null);
    if (e.dashed) line.attr('stroke-dasharray', '5 5');
    if (e.label) {
      root.append('text')
        .attr('class', 'edge-label')
        .attr('x', e.labelAt.x).attr('y', e.labelAt.y)
        .attr('text-anchor', 'middle')
        .attr('fill', pal.nodeText)
        .attr('font-family', 'Geist, sans-serif')
        .attr('font-size', 13)
        .text(e.label);
    }
    edgeSel[id] = line;
  });

  // Nodes (rect + one or two lines of label text).
  var nodeSel = {};
  Object.keys(NODES).forEach(function (id) {
    var n = NODES[id];
    var g = root.append('g').attr('class', 'node');
    g.append('rect')
      .attr('x', n.x).attr('y', n.y)
      .attr('width', n.w).attr('height', n.h)
      .attr('rx', 8)
      .attr('fill', pal.nodeFill)
      .attr('stroke', pal.nodeStroke)
      .attr('stroke-width', 1.5);
    var c = center(n);
    var lines = n.label;
    var startDy = -(lines.length - 1) * 9;
    lines.forEach(function (ln, i) {
      g.append('text')
        .attr('x', c.x).attr('y', c.y + startDy + i * 18)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', pal.nodeText)
        .attr('font-family', 'Geist, sans-serif')
        .attr('font-size', 14)
        .text(ln);
    });
    nodeSel[id] = g;
  });

  // The travelling data packet.
  var packet = root.append('circle')
    .attr('class', 'packet')
    .attr('r', 9)
    .attr('cx', PACKET_POS[0].x)
    .attr('cy', PACKET_POS[0].y)
    .attr('fill', pal.packet)
    .attr('stroke', pal.packetStroke)
    .attr('stroke-width', 1.5)
    .style('opacity', 0);

  // --- styling helpers ---
  function styleNode(id, active) {
    var g = nodeSel[id];
    g.select('rect')
      .attr('fill', active ? pal.active : pal.nodeFill)
      .attr('stroke', active ? pal.activeStroke : pal.nodeStroke)
      .attr('stroke-width', active ? 2.5 : 1.5);
    g.selectAll('text').attr('fill', active ? pal.activeText : pal.nodeText);
  }
  function styleEdge(id, active) {
    var line = edgeSel[id];
    line.attr('stroke', active ? pal.active : pal.edge)
        .attr('stroke-width', active ? 3.5 : 1.5)
        .attr('marker-end', EDGES[id].arrow ? (active ? 'url(#arrow-active)' : 'url(#arrow)') : null);
  }
  function applyHighlight(stageIdx) {
    Object.keys(nodeSel).forEach(function (id) { styleNode(id, false); });
    Object.keys(edgeSel).forEach(function (id) { styleEdge(id, false); });
    var h = STAGES[stageIdx].highlight;
    if (h.node) styleNode(h.node, true);
    if (h.edge) styleEdge(h.edge, true);
  }
  function setCaption(stageIdx) {
    captionEl.textContent = STAGES[stageIdx].caption;
  }

  // --- transitions ---
  function bumpToken() { playToken++; return playToken; }

  function stepTo(i, animated) {
    return new Promise(function (resolve) {
      i = Math.max(0, Math.min(STAGES.length - 1, i));
      var token = playToken;
      if (i === current) { resolve(); return; }
      var singleStep = Math.abs(i - current) === 1;
      var pos = PACKET_POS[i];
      var transit = singleStep ? STAGES[i].transit : null;

      packet.style('opacity', 1);
      if (transit) styleEdge(transit, true);

      function done() {
        if (destroyed || token !== playToken) { resolve(); return; }
        current = i;
        applyHighlight(current);
        setCaption(current);
        if (onStageChange) onStageChange(current);
        resolve();
      }

      if (animated && !reducedMotion && singleStep) {
        packet.transition()
          .duration(650)
          .ease(d3.easeCubicInOut)
          .attr('cx', pos.x)
          .attr('cy', pos.y)
          .on('end', done)
          .on('interrupt', done);
      } else {
        packet.attr('cx', pos.x).attr('cy', pos.y).style('opacity', 1);
        done();
      }
    });
  }

  function play() {
    var token = bumpToken();
    function loop() {
      if (destroyed || token !== playToken || current >= STAGES.length - 1) return Promise.resolve();
      return stepTo(current + 1, true).then(loop);
    }
    return loop();
  }

  function next(animated) { bumpToken(); return stepTo(current + 1, animated); }
  function prev(animated) { bumpToken(); return stepTo(current - 1, animated); }

  function reset() {
    bumpToken();
    current = 0;
    packet.interrupt().attr('cx', PACKET_POS[0].x).attr('cy', PACKET_POS[0].y)
      .style('opacity', reducedMotion ? 1 : 0);
    applyHighlight(0);
    setCaption(0);
    if (onStageChange) onStageChange(0);
  }

  function setTheme(isDarkFn) {
    pal = palette(isDarkFn());
    svg.select('#arrow path').attr('fill', pal.edge);
    svg.select('#arrow-active path').attr('fill', pal.active);
    root.select('rect.subgraph').attr('fill', pal.subFill).attr('stroke', pal.subStroke);
    root.select('text.subgraph-label').attr('fill', pal.subText);
    root.selectAll('text.edge-label').attr('fill', pal.nodeText);
    packet.attr('fill', pal.packet).attr('stroke', pal.packetStroke);
    applyHighlight(current); // re-applies node + edge fills/strokes for the current stage
  }

  function destroy() { destroyed = true; bumpToken(); }

  // Initial render: stage 0. The packet is hidden until the first transition
  // (unless reduced motion, where it stays visible as a static marker).
  applyHighlight(0);
  setCaption(0);
  packet.attr('cx', PACKET_POS[0].x).attr('cy', PACKET_POS[0].y)
    .style('opacity', reducedMotion ? 1 : 0);

  return {
    get current() { return current; },
    stageCount: STAGES.length,
    stepTo: stepTo, next: next, prev: prev,
    play: play, reset: reset, setTheme: setTheme, destroy: destroy,
  };
}
