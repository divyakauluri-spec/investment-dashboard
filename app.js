/* ============================================================
   INVESTMENT BEHAVIOR DASHBOARD — app logic
   Reads RAW_DATA (from data.js), derives fields, renders all
   charts and tables themed to the ledger/financial-instrument
   palette defined in index.html.
   ============================================================ */

(function(){

  // ---------- palette (mirrors CSS vars) ----------
  const COLORS = {
    ink:      '#0B1F3A',
    inkSoft:  '#16294a',
    paper:    '#F7F5F0',
    paperRaised: '#FCFBF8',
    gold:     '#C9A23E',
    goldSoft: '#e3cd92',
    teal:     '#2F6F5E',
    brick:    '#8B3A3A',
    body:     '#5B5347',
    hairline: 'rgba(11,31,58,0.14)'
  };

  // a deliberate, restrained categorical sequence drawn from the
  // ledger palette rather than Plotly defaults
  const CAT_SEQUENCE = [COLORS.ink, COLORS.gold, COLORS.teal, COLORS.brick, '#7A8B99', '#A8C3B8', '#D9B65E', '#4A5A72'];

  const FONT_BODY = "'IBM Plex Sans', sans-serif";
  const FONT_MONO = "'IBM Plex Mono', monospace";

  // ---------- 1. DATA PREP ----------
  const duration_map = {
    "Less than 1 year": 0.5,
    "1-3 years": 2,
    "3-5 years": 4,
    "More than 5 years": 6
  };
  const expect_map = {
    "10%-20%": 15,
    "20%-30%": 25,
    "30%-40%": 35
  };

  const df = RAW_DATA.map(r => {
    const row = Object.assign({}, r);
    row.age = Number(row.age);
    row.Duration_Years = duration_map[row.Duration] ?? null;
    row.Expect_Numeric = expect_map[row.Expect] ?? null;
    return row;
  });

  const N = df.length;

  // ---------- helpers ----------
  function mean(arr){ return arr.reduce((a,b)=>a+b,0) / arr.length; }
  function median(arr){
    const s = [...arr].sort((a,b)=>a-b);
    const mid = Math.floor(s.length/2);
    return s.length % 2 ? s[mid] : (s[mid-1]+s[mid])/2;
  }
  function stddev(arr){
    const m = mean(arr);
    const variance = arr.reduce((a,b)=>a + Math.pow(b-m,2), 0) / (arr.length - 1);
    return Math.sqrt(variance);
  }
  function pearson(x, y){
    const n = x.length;
    const mx = mean(x), my = mean(y);
    let num = 0, dx2 = 0, dy2 = 0;
    for(let i=0;i<n;i++){
      const dx = x[i]-mx, dy = y[i]-my;
      num += dx*dy; dx2 += dx*dx; dy2 += dy*dy;
    }
    return num / Math.sqrt(dx2*dy2);
  }
  function valueCounts(arr){
    const m = new Map();
    arr.forEach(v => m.set(v, (m.get(v)||0)+1));
    // sort descending by count for a clean ledger read
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  }
  function fmt(n, d=2){
    return Number(n).toFixed(d);
  }

  // ---------- shared plotly layout base ----------
  function baseLayout(extra){
    return Object.assign({
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: FONT_BODY, color: COLORS.body, size: 12 },
      margin: { t: 10, r: 18, b: 40, l: 48 },
      showlegend: false,
      xaxis: {
        gridcolor: COLORS.hairline,
        zerolinecolor: COLORS.hairline,
        tickfont: { family: FONT_MONO, size: 11, color: COLORS.body }
      },
      yaxis: {
        gridcolor: COLORS.hairline,
        zerolinecolor: COLORS.hairline,
        tickfont: { family: FONT_MONO, size: 11, color: COLORS.body }
      },
      hoverlabel: {
        bgcolor: COLORS.ink,
        font: { family: FONT_MONO, color: COLORS.paper, size: 12 },
        bordercolor: COLORS.gold
      }
    }, extra || {});
  }
  const PLOTLY_CONFIG = { displayModeBar: false, responsive: true };

  function renderBar(elId, pairs, opts){
    opts = opts || {};
    const labels = pairs.map(p => p[0]);
    const counts = pairs.map(p => p[1]);
    const colors = labels.map((_,i) => CAT_SEQUENCE[i % CAT_SEQUENCE.length]);

    const trace = {
      type: 'bar',
      x: opts.horizontal ? counts : labels,
      y: opts.horizontal ? labels : counts,
      orientation: opts.horizontal ? 'h' : 'v',
      text: counts.map(String),
      textposition: opts.horizontal ? 'outside' : 'outside',
      textfont: { family: FONT_MONO, size: 11.5, color: COLORS.ink },
      marker: { color: colors, line: { width: 0 } },
      hovertemplate: opts.horizontal ? '%{y}: %{x}<extra></extra>' : '%{x}: %{y}<extra></extra>'
    };

    const layout = baseLayout({
      margin: opts.horizontal
        ? { t: 10, r: 36, b: 36, l: opts.leftMargin || 140 }
        : { t: 10, r: 14, b: 90, l: 40 },
      xaxis: Object.assign({}, baseLayout().xaxis, opts.horizontal ? { showgrid:false } : { tickangle: -25, automargin:true }),
      yaxis: Object.assign({}, baseLayout().yaxis, opts.horizontal ? { automargin:true } : { showgrid:true })
    });

    Plotly.newPlot(elId, [trace], layout, PLOTLY_CONFIG);
  }

  function renderDonut(elId, pairs){
    const labels = pairs.map(p => p[0]);
    const values = pairs.map(p => p[1]);
    const colors = labels.map((_,i) => CAT_SEQUENCE[i % CAT_SEQUENCE.length]);

    const trace = {
      type: 'pie',
      labels, values,
      hole: 0.62,
      marker: { colors, line: { color: COLORS.paperRaised, width: 2 } },
      textinfo: 'label+percent',
      textfont: { family: FONT_MONO, size: 12, color: COLORS.ink },
      hovertemplate: '%{label}: %{value}<extra></extra>'
    };

    const layout = baseLayout({
      margin: { t: 10, r: 10, b: 10, l: 10 },
      annotations: [{
        text: String(values.reduce((a,b)=>a+b,0)),
        showarrow: false,
        font: { family: FONT_MONO, size: 26, color: COLORS.ink },
        x: 0.5, y: 0.52
      },{
        text: 'TOTAL',
        showarrow: false,
        font: { family: FONT_MONO, size: 10, color: COLORS.body },
        x: 0.5, y: 0.40
      }]
    });

    Plotly.newPlot(elId, [trace], layout, PLOTLY_CONFIG);
  }

  // ---------- 2. KPI RENDER ----------
  function renderKPI(){
    const avgAge = mean(df.map(d => d.age));
    const kpis = [
      { label: 'Total Participants', value: N, unit: '' },
      { label: 'Average Age', value: fmt(avgAge,1), unit: 'yrs' },
      { label: 'Total Records', value: N, unit: '' },
      { label: 'Total Variables', value: Object.keys(df[0]).length - 2, unit: '' } // minus derived cols, matches original column count
    ];
    const row = document.getElementById('kpi-row');
    row.innerHTML = kpis.map(k => `
      <div class="line-item">
        <div class="label">${k.label}</div>
        <div class="value">${k.value}${k.unit ? `<span class="unit">${k.unit}</span>` : ''}</div>
        <div class="underline"></div>
      </div>
    `).join('');
  }

  function renderKPI2(){
    const avgDuration = mean(df.map(d => d.Duration_Years).filter(v => v != null));
    const ages = df.map(d => d.age);
    const durations = df.map(d => d.Duration_Years);
    const corr = pearson(ages, durations);
    const kpis = [
      { label: 'Avg. Investment Duration', value: fmt(avgDuration,2), unit: 'yrs', note: 'midpoint of stated range' },
      { label: 'Correlation: Age & Duration', value: (corr>=0?'+':'') + fmt(corr,2), unit: '', note: 'Pearson r, age vs. years held' },
    ];
    const row = document.getElementById('kpi-row-2');
    row.innerHTML = kpis.map(k => `
      <div class="line-item" style="grid-column: span 2;">
        <div class="label">${k.label}</div>
        <div class="value">${k.value}${k.unit ? `<span class="unit">${k.unit}</span>` : ''}</div>
        <div class="underline"></div>
        <div class="note">${k.note}</div>
      </div>
    `).join('');

    // correlation callout — written in plain ledger language
    const strength = Math.abs(corr) < 0.15 ? 'negligible'
      : Math.abs(corr) < 0.35 ? 'weak'
      : Math.abs(corr) < 0.6 ? 'moderate'
      : 'strong';
    const direction = corr >= 0 ? 'rises' : 'falls';
    document.getElementById('corr-callout').innerHTML =
      `<b>Reading:</b> across this set, investment duration ${direction} only ${strength === 'negligible' ? 'negligibly' : strength + 'ly'} with age (r = ${fmt(corr,2)}). ` +
      `Age alone does not strongly predict how long a respondent holds an investment — bubble size (expected return) shows more visible spread than position along either axis.`;
  }

  // ---------- 3. DESCRIPTIVE STATS TABLE ----------
  function renderDescTable(){
    const vars = [
      { key: 'age', label: 'Age' },
      { key: 'Duration_Years', label: 'Duration (years)' },
      { key: 'Expect_Numeric', label: 'Expected Return (%)' }
    ];
    const tbody = document.querySelector('#desc-table tbody');
    tbody.innerHTML = vars.map(v => {
      const arr = df.map(d => d[v.key]).filter(x => x != null);
      return `<tr>
        <td>${v.label}</td>
        <td>${fmt(mean(arr))}</td>
        <td>${fmt(median(arr))}</td>
        <td>${fmt(stddev(arr))}</td>
      </tr>`;
    }).join('');
  }

  // ---------- 4. CHARTS ----------
  function renderOverviewCharts(){
    renderDonut('chart-gender', valueCounts(df.map(d => d.gender)));
    renderBar('chart-avenue', valueCounts(df.map(d => d.Avenue)));
  }

  function renderReasonCharts(){
    renderBar('chart-reason-equity', valueCounts(df.map(d => d.Reason_Equity)), { horizontal:true, leftMargin: 160 });
    renderBar('chart-reason-bonds',  valueCounts(df.map(d => d.Reason_Bonds)),  { horizontal:true, leftMargin: 160 });
    renderBar('chart-reason-mutual', valueCounts(df.map(d => d.Reason_Mutual)), { horizontal:true, leftMargin: 160 });
    renderBar('chart-reason-fd',     valueCounts(df.map(d => d.Reason_FD)),     { horizontal:true, leftMargin: 160 });
  }

  function renderDurationCharts(){
    renderBar('chart-savings', valueCounts(df.map(d => d["What are your savings objectives?"])));
    renderBar('chart-source',  valueCounts(df.map(d => d.Source)), { horizontal:true, leftMargin: 190 });
    renderBar('chart-expect',  valueCounts(df.map(d => d.Expect)), { horizontal:true, leftMargin: 100 });

    // scatter: age vs duration, sized/colored by expected return
    const x = df.map(d => d.age);
    const y = df.map(d => d.Duration_Years);
    const size = df.map(d => d.Expect_Numeric);
    const text = df.map(d => `Gender: ${d.gender}<br>Avenue: ${d.Avenue}<br>Expected: ${d.Expect}<br>Duration: ${d.Duration}`);

    const trace = {
      type: 'scatter',
      mode: 'markers',
      x, y, text,
      marker: {
        size: size,
        sizeref: 0.5,
        sizemode: 'diameter',
        sizemin: 10,
        color: size,
        colorscale: [[0, COLORS.teal],[0.5, COLORS.gold],[1, COLORS.brick]],
        line: { color: COLORS.ink, width: 1 },
        opacity: 0.85,
        colorbar: {
          title: { text: 'Expected %', font: { family: FONT_MONO, size: 10, color: COLORS.body } },
          tickfont: { family: FONT_MONO, size: 10, color: COLORS.body },
          thickness: 12,
          outlinewidth: 0
        }
      },
      hovertemplate: 'Age %{x}, Duration %{y}y<br>%{text}<extra></extra>'
    };

    const layout = baseLayout({
      margin: { t: 10, r: 90, b: 50, l: 56 },
      xaxis: Object.assign({}, baseLayout().xaxis, { title: { text: 'Age', font: { family: FONT_MONO, size: 11, color: COLORS.body } } }),
      yaxis: Object.assign({}, baseLayout().yaxis, { title: { text: 'Duration (years)', font: { family: FONT_MONO, size: 11, color: COLORS.body } } })
    });

    Plotly.newPlot('chart-scatter', [trace], layout, PLOTLY_CONFIG);
  }

  // ---------- 5. NAVIGATION ----------
  function setupNav(){
    const buttons = document.querySelectorAll('.ledger-nav .entry');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.page;
        buttons.forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.page').forEach(p => {
          p.classList.toggle('active', p.id === `page-${target}`);
        });
        // resize plots on tab switch — Plotly needs this when container was hidden
        window.dispatchEvent(new Event('resize'));
      });
    });
  }

  function renderFootCounts(){
    const stamp = `${N} RESPONDENTS — RENDERED CLIENT-SIDE`;
    ['foot-count-1','foot-count-2','foot-count-3'].forEach(id => {
      document.getElementById(id).textContent = stamp;
    });
  }

  // ---------- INIT ----------
  function init(){
    renderKPI();
    renderDescTable();
    renderOverviewCharts();

    renderReasonCharts();

    renderKPI2();
    renderDurationCharts();

    renderFootCounts();
    setupNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();