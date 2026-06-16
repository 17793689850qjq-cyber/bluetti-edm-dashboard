"""Build YoY / MoM comparison blocks for dashboard JSON."""

from __future__ import annotations

from typing import Any


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None if current == 0 else None
    return (current - previous) / previous


def _delta(current: float, previous: float) -> float:
    return current - previous


def _fmt_pct(x: float | None) -> str | None:
    if x is None:
        return None
    sign = "+" if x > 0 else ""
    return f"{sign}{(x * 100):.1f}%"


def _snapshot_from_totals(totals: dict) -> dict[str, Any]:
    g = totals.get("global") or {}
    return {
        "gmvCny": totals.get("gmvCny", g.get("gmvCny", 0)),
        "campaignCny": totals.get("campaignCny", 0),
        "flowCny": totals.get("flowCny", 0),
        "campaignShare": totals.get("campaignShare", 0),
        "flowShare": totals.get("flowShare", 0),
        "openRate": g.get("openRate", 0),
        "clickRate": g.get("clickRate", 0),
        "convRate": g.get("convRate", 0),
    }


def _site_snapshot(row: dict) -> dict[str, Any]:
    c = row["campaign"]
    f = row["flow"]
    delivered = c["delivered"] + f["delivered"] or 1
    gmv_local = c["gmv"] + f["gmv"]
    return {
        "gmvLocal": gmv_local,
        "gmvCny": row["totalGmvCny"],
        "campaignGmvLocal": c["gmv"],
        "flowGmvLocal": f["gmv"],
        "campaignGmvCny": row["campaignGmvCny"],
        "flowGmvCny": row["flowGmvCny"],
        "campaignShare": row["totalGmvCny"] and row["campaignGmvCny"] / row["totalGmvCny"] or 0,
        "flowShare": row["totalGmvCny"] and row["flowGmvCny"] / row["totalGmvCny"] or 0,
        "openRate": (c["openRate"] * c["delivered"] + f["openRate"] * f["delivered"]) / delivered,
        "clickRate": (c["clickRate"] * c["delivered"] + f["clickRate"] * f["delivered"]) / delivered,
        "convRate": (c["conversions"] + f["conversions"]) / delivered,
        "currency": row["currency"],
    }


def _compare_metric(
    key: str,
    label: str,
    current: float,
    mom: float | None,
    yoy: float | None,
    *,
    kind: str = "number",
    higher_is_better: bool = True,
) -> dict[str, Any]:
    mom_pct = _pct_change(current, mom) if mom is not None else None
    yoy_pct = _pct_change(current, yoy) if yoy is not None else None
    return {
        "key": key,
        "label": label,
        "kind": kind,
        "higherIsBetter": higher_is_better,
        "current": current,
        "mom": {
            "value": mom,
            "delta": _delta(current, mom) if mom is not None else None,
            "pct": mom_pct,
            "pctLabel": _fmt_pct(mom_pct),
        },
        "yoy": {
            "value": yoy,
            "delta": _delta(current, yoy) if yoy is not None else None,
            "pct": yoy_pct,
            "pctLabel": _fmt_pct(yoy_pct),
        },
    }


GLOBAL_METRICS: list[tuple[str, str, str, bool]] = [
    ("gmvCny", "合计 GMV (CNY)", "cny", True),
    ("campaignCny", "Campaign GMV (CNY)", "cny", True),
    ("flowCny", "Flow GMV (CNY)", "cny", True),
    ("campaignShare", "Campaign 占比", "rate", True),
    ("flowShare", "Flow 占比", "rate", True),
    ("openRate", "打开率", "rate", True),
    ("clickRate", "点击率", "rate", True),
    ("convRate", "转化率", "rate", True),
]

SITE_METRICS: list[tuple[str, str, str, bool]] = [
    ("gmvLocal", "合计 GMV (本位币)", "local", True),
    ("gmvCny", "合计 GMV (CNY)", "cny", True),
    ("campaignGmvLocal", "Campaign GMV (本位币)", "local", True),
    ("flowGmvLocal", "Flow GMV (本位币)", "local", True),
    ("campaignGmvCny", "Campaign GMV (CNY)", "cny", True),
    ("flowGmvCny", "Flow GMV (CNY)", "cny", True),
    ("campaignShare", "Campaign 占比", "rate", True),
    ("flowShare", "Flow 占比", "rate", True),
    ("openRate", "打开率", "rate", True),
    ("clickRate", "点击率", "rate", True),
    ("convRate", "转化率", "rate", True),
]


def _build_scope_metrics(
    current: dict[str, Any],
    mom: dict[str, Any] | None,
    yoy: dict[str, Any] | None,
    metric_defs: list[tuple[str, str, str, bool]],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for key, label, kind, higher in metric_defs:
        out.append(
            _compare_metric(
                key,
                label,
                float(current.get(key, 0) or 0),
                float(mom[key]) if mom and mom.get(key) is not None else None,
                float(yoy[key]) if yoy and yoy.get(key) is not None else None,
                kind=kind,
                higher_is_better=higher,
            )
        )
    return out


def build_comparisons(
    current_totals: dict,
    mom_totals: dict | None,
    yoy_totals: dict | None,
    sites_current: list[dict],
    sites_mom: list[dict] | None,
    sites_yoy: list[dict] | None,
    *,
    period_meta: dict | None = None,
    mom_period: dict | None = None,
    yoy_period: dict | None = None,
) -> dict[str, Any]:
    """Return comparisons block with global + per-site MoM/YoY metrics."""
    cur_global = _snapshot_from_totals(current_totals)
    mom_global = _snapshot_from_totals(mom_totals) if mom_totals else None
    yoy_global = _snapshot_from_totals(yoy_totals) if yoy_totals else None

    mom_by_site = {r["region"]: r for r in (sites_mom or [])}
    yoy_by_site = {r["region"]: r for r in (sites_yoy or [])}

    sites_out: dict[str, Any] = {}
    for row in sites_current:
        code = row["region"]
        cur = _site_snapshot(row)
        mom_row = mom_by_site.get(code)
        yoy_row = yoy_by_site.get(code)
        mom_snap = _site_snapshot(mom_row) if mom_row else None
        yoy_snap = _site_snapshot(yoy_row) if yoy_row else None
        sites_out[code] = {
            "currency": row["currency"],
            "metrics": _build_scope_metrics(cur, mom_snap, yoy_snap, SITE_METRICS),
        }

    return {
        "meta": {
            "current": period_meta,
            "mom": mom_period,
            "yoy": yoy_period,
        },
        "global": {
            "metrics": _build_scope_metrics(cur_global, mom_global, yoy_global, GLOBAL_METRICS),
        },
        "sites": sites_out,
    }


def seed_comparison_snapshots(
    rows: list[dict],
    totals: dict,
    *,
    mom_factors: dict[str, float] | None = None,
    yoy_factors: dict[str, float] | None = None,
) -> tuple[dict, list[dict], dict, list[dict]]:
    """Derive plausible MoM/YoY snapshots from current seed data."""
    mom_factors = mom_factors or {
        "gmvCny": 0.92,
        "campaignCny": 0.9,
        "flowCny": 0.94,
        "openRate": 0.98,
        "clickRate": 0.97,
        "convRate": 0.95,
    }
    yoy_factors = yoy_factors or {
        "gmvCny": 0.85,
        "campaignCny": 0.82,
        "flowCny": 0.88,
        "openRate": 0.96,
        "clickRate": 0.94,
        "convRate": 0.9,
    }

    def scale_snapshot(snap: dict[str, Any], factors: dict[str, float]) -> dict[str, Any]:
        out = dict(snap)
        for k, f in factors.items():
            if k in out:
                out[k] = out[k] * f
        total = out.get("gmvCny") or out.get("campaignCny", 0) + out.get("flowCny", 0)
        if total:
            out["campaignShare"] = out.get("campaignCny", 0) / total
            out["flowShare"] = out.get("flowCny", 0) / total
        return out

    cur_global = _snapshot_from_totals(totals)
    mom_global = scale_snapshot(cur_global, mom_factors)
    yoy_global = scale_snapshot(cur_global, yoy_factors)

    mom_totals = {
        "gmvCny": mom_global["gmvCny"],
        "campaignCny": mom_global["campaignCny"],
        "flowCny": mom_global["flowCny"],
        "campaignShare": mom_global["campaignShare"],
        "flowShare": mom_global["flowShare"],
        "global": {
            "openRate": mom_global["openRate"],
            "clickRate": mom_global["clickRate"],
            "convRate": mom_global["convRate"],
            "gmvCny": mom_global["gmvCny"],
        },
    }
    yoy_totals = {
        "gmvCny": yoy_global["gmvCny"],
        "campaignCny": yoy_global["campaignCny"],
        "flowCny": yoy_global["flowCny"],
        "campaignShare": yoy_global["campaignShare"],
        "flowShare": yoy_global["flowShare"],
        "global": {
            "openRate": yoy_global["openRate"],
            "clickRate": yoy_global["clickRate"],
            "convRate": yoy_global["convRate"],
            "gmvCny": yoy_global["gmvCny"],
        },
    }

    def scale_row(row: dict, factor: float) -> dict:
        c = dict(row["campaign"])
        f = dict(row["flow"])
        for block in (c, f):
            block["gmv"] = round(block["gmv"] * factor, 2)
            block["conversions"] = max(0, int(block["conversions"] * factor))
        camp_cny = round(row["campaignGmvCny"] * factor, 0)
        flow_cny = round(row["flowGmvCny"] * factor, 0)
        return {
            **row,
            "campaign": c,
            "flow": f,
            "campaignGmvCny": camp_cny,
            "flowGmvCny": flow_cny,
            "totalGmvCny": camp_cny + flow_cny,
        }

    mom_rows = [scale_row(r, mom_factors.get("gmvCny", 0.92)) for r in rows]
    yoy_rows = [scale_row(r, yoy_factors.get("gmvCny", 0.85)) for r in rows]
    return mom_totals, mom_rows, yoy_totals, yoy_rows
