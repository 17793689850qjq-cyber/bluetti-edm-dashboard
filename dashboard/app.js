/* global Chart */

let DATA = null;
let pieChart = null;
let barChart = null;

const $ = (sel) => document.querySelector(sel);

function cny(n) {
  if (n >= 1e6) return `¥${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `¥${Math.round(n / 1e3)}K`;
  return `¥${Math.round(n)}`;
}

function pct(x, digits = 1) {
  return `${(x * 100).toFixed(digits)}%`;
}

function pickMetrics(row, view) {
  if (view === "campaign") return row.campaign;
  if (view === "flow") return row.flow;
  const c = row.campaign;
  const f = row.flow;
  const delivered = c.delivered + f.delivered || 1;
  return {
    openRate: (c.openRate * c.delivered + f.openRate * f.delivered) / delivered,
    convRate: (c.conversions + f.conversions) / delivered,
    clickRate: (c.clickRate * c.delivered + f.clickRate * f.delivered) / delivered,
  };
}

function rowTone(row, totalGmv) {
  const share = row.totalGmvCny / totalGmv;
  if (share >= 0.15) return "tone-top";
  return "";
}

function alertTone(priority) {
  if (priority === "P0") return "tone-p0";
  if (priority === "P1") return "tone-p1";
  return "tone-warn";
}

async function loadData() {
  const res = await fetch("data/dashboard.json");
  if (!res.ok) throw new Error(`无法加载 dashboard.json (${res.status})`);
  return res.json();
}

function renderMeta() {
  const m = DATA.meta;
  const seed = m.seed ? " · 快照预览" : "";
  const errs = m.errors?.length ? ` · ${m.errors.length} 站同步失败` : "";
  $("#meta-line").textContent =
    `${m.period} · 更新 ${m.updatedAt.replace("T", " ").replace("Z", " UTC")} · ${m.siteCount} 站${seed}${errs}`;
}

function renderKpis() {
  const g = DATA.totals.global;
  const t = DATA.totals;
  $("#kpi-grid").innerHTML = [
    { label: "全球 GMV", value: cny(t.gmvCny), cls: "info" },
    { label: "Campaign 占比", value: pct(t.campaignShare), cls: "" },
    { label: "Flow 占比", value: pct(t.flowShare), cls: "success" },
    { label: "打开率", value: pct(g.openRate), cls: "" },
    { label: "点击率", value: pct(g.clickRate, 2), cls: "" },
    { label: "转化率", value: pct(g.convRate, 2), cls: "" },
  ]
    .map(
      (k) => `
    <div class="kpi">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.cls}">${k.value}</div>
    </div>`
    )
    .join("");
}

function renderCharts() {
  const t = DATA.totals;
  const pieCtx = $("#pie-chart");
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: ["Campaign", "Flow"],
      datasets: [
        {
          data: [t.campaignCny, t.flowCny],
          backgroundColor: ["#3b82f6", "#22c55e"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      cutout: "55%",
    },
  });
  $("#pie-legend").innerHTML = `
    <div class="total">合计 ${cny(t.gmvCny)}</div>
    <div class="legend-item"><span class="legend-dot" style="background:#3b82f6"></span>Campaign ${cny(t.campaignCny)} (${pct(t.campaignShare)})</div>
    <div class="legend-item"><span class="legend-dot" style="background:#22c55e"></span>Flow ${cny(t.flowCny)} (${pct(t.flowShare)})</div>
  `;

  const rows = DATA.rows.slice().sort((a, b) => b.totalGmvCny - a.totalGmvCny);
  const barCtx = $("#bar-chart");
  if (barChart) barChart.destroy();
  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.region),
      datasets: [
        { label: "Campaign", data: rows.map((r) => r.campaignGmvCny), backgroundColor: "#3b82f6" },
        { label: "Flow", data: rows.map((r) => r.flowGmvCny), backgroundColor: "#22c55e" },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { callback: (v) => cny(v) }, grid: { color: "#2d3a4f" } },
        y: { stacked: true, grid: { display: false } },
      },
      plugins: { legend: { position: "bottom", labels: { color: "#8b9cb3" } } },
    },
  });
}

function renderOverviewTable() {
  const view = $("#metric-view").value;
  const totalGmv = DATA.totals.gmvCny;
  const tbody = $("#overview-table tbody");
  tbody.innerHTML = DATA.rows
    .map((row) => {
      const m = pickMetrics(row, view);
      const totalCny =
        view === "campaign" ? row.campaignGmvCny : view === "flow" ? row.flowGmvCny : row.totalGmvCny;
      return `<tr class="${rowTone(row, totalGmv)}">
        <td>${row.region}</td>
        <td class="num">${cny(row.campaignGmvCny)}</td>
        <td class="num">${cny(row.flowGmvCny)}</td>
        <td class="num">${cny(totalCny)}</td>
        <td class="num">${pct(m.openRate)}</td>
        <td class="num">${pct(m.convRate, 2)}</td>
        <td class="num">${pct(totalCny / totalGmv, 1)}</td>
      </tr>`;
    })
    .join("");
}

function renderEmailList(items, kind) {
  if (!items?.length) return `<p class="hint">暂无数据</p>`;
  return items
    .map((item) => {
      const metrics = item.metrics
        ? `<div class="email-audience">打开 ${pct(item.metrics.openRate)} · 转化 ${pct(item.metrics.convRate, 2)}</div>`
        : "";
      return `
      <div class="email-card ${kind}">
        <div class="email-name">${escapeHtml(item.name)}</div>
        <div class="email-subject">${escapeHtml(item.subject || "—")}</div>
        <div class="email-audience">${escapeHtml(item.audience || "—")}</div>
        ${metrics}
        <ul class="email-reasons">${(item.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      </div>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSites() {
  const container = $("#sites-container");
  const order = DATA.siteOrder || DATA.rows.map((r) => r.region);
  container.innerHTML = order
    .map((code) => {
      const why = DATA.siteWhy[code];
      if (!why) return "";
      return `
      <div class="site-block" data-site="${code}">
        <button type="button" class="site-header" aria-expanded="false">
          <span>${code}</span>
          <span class="chevron">›</span>
        </button>
        <div class="site-body">
          <p class="site-summary">${escapeHtml(why.summary || "")}</p>
          <div class="sub-block">
            <button type="button" class="sub-header">Campaign 最佳 / 待优化 <span class="chevron">›</span></button>
            <div class="sub-body">
              <p class="hint">最佳</p>
              ${renderEmailList(why.campaignBest, "best")}
              <p class="hint" style="margin-top:0.75rem">待优化</p>
              ${renderEmailList(why.campaignWorst, "worst")}
            </div>
          </div>
          <div class="sub-block">
            <button type="button" class="sub-header">Flow 最佳 / 待优化 <span class="chevron">›</span></button>
            <div class="sub-body">
              <p class="hint">最佳</p>
              ${renderEmailList(why.flowBest, "best")}
              <p class="hint" style="margin-top:0.75rem">待优化</p>
              ${renderEmailList(why.flowWorst, "worst")}
            </div>
          </div>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".site-header").forEach((btn) => {
    btn.addEventListener("click", () => {
      const block = btn.closest(".site-block");
      block.classList.toggle("open");
      btn.setAttribute("aria-expanded", block.classList.contains("open"));
    });
  });
  container.querySelectorAll(".sub-header").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest(".sub-block").classList.toggle("open"));
  });
}

function renderFlow() {
  const tbody = $("#flow-table tbody");
  tbody.innerHTML = (DATA.flowAlerts || [])
    .map(
      (a) => `<tr class="${alertTone(a.priority)}">
      <td>${a.priority}</td>
      <td>${a.region}</td>
      <td>${escapeHtml(a.flow)}</td>
      <td>${a.category}</td>
      <td>${escapeHtml(a.issue)}</td>
      <td>${escapeHtml(a.action)}</td>
    </tr>`
    )
    .join("");
}

function renderPlaybook() {
  const s = DATA.successPlaybook;
  const f = DATA.failurePlaybook;
  $("#playbook-grid").innerHTML = `
    <div class="card playbook-card">
      <h3>${escapeHtml(s.title)}</h3>
      <div class="playbook-section"><h4>Campaign</h4><ul>${s.campaign.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>
      <div class="playbook-section"><h4>Flow</h4><ul>${s.flow.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>
    </div>
    <div class="card playbook-card">
      <h3>${escapeHtml(f.title)}</h3>
      <div class="playbook-section"><h4>Campaign</h4><ul>${f.campaign.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>
      <div class="playbook-section"><h4>Flow</h4><ul>${f.flow.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>
    </div>`;
}

function showSection(name) {
  document.querySelectorAll(".view").forEach((el) => el.classList.add("hidden"));
  $(`#view-${name}`).classList.remove("hidden");
  $("#metric-filter-wrap").classList.toggle("hidden", name !== "overview");
  if (name === "overview") {
    renderKpis();
    renderCharts();
    renderOverviewTable();
  }
}

async function init() {
  try {
    DATA = await loadData();
    $("#loading").classList.add("hidden");
    renderMeta();
    renderSites();
    renderFlow();
    renderPlaybook();
    showSection($("#section-select").value);

    $("#section-select").addEventListener("change", (e) => showSection(e.target.value));
    $("#metric-view").addEventListener("change", () => renderOverviewTable());
  } catch (err) {
    $("#loading").classList.add("hidden");
    const el = $("#error");
    el.textContent = err.message;
    el.classList.remove("hidden");
  }
}

document.addEventListener("DOMContentLoaded", init);
