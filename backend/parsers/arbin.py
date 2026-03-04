"""
parsers/arbin.py
────────────────
Parses Arbin BT-2000 / MITS Pro CSV and XLSX exports.

Expected columns (case-insensitive, spaces or underscores):
  Cycle_Index
  Discharge_Capacity(Ah)   or  Dchg_Capacity(Ah)
  Charge_Capacity(Ah)      or  Chg_Capacity(Ah)
  Voltage(V)               or  Charge_Voltage(V) / Discharge_Voltage(V)
  DCIR(Ohm)                or  Internal_Resistance(Ohm)  [optional — ESR]

Returns a list of per-cycle dicts:
  {
    cycle              : int,
    discharge_cap_mah  : float | None,
    charge_cap_mah     : float | None,
    coulombic_efficiency: float | None,   # %
    voltage_max        : float | None,    # V
    voltage_min        : float | None,    # V
    voltage_mid        : float | None,    # V  (avg of max+min)
    esr_mohm           : float | None,    # mΩ (converted from Ohm)
  }
"""

from __future__ import annotations
import io
from typing import Optional
import pandas as pd
import numpy as np


# ── column aliases ────────────────────────────────────────────────────────
_CYCLE_COLS   = ["cycle_index", "cycle", "cycle_number"]
_DCH_CAP_COLS = ["discharge_capacity(ah)", "discharge_capacity", "dchg_capacity(ah)"]
_CHG_CAP_COLS = ["charge_capacity(ah)",    "charge_capacity",    "chg_capacity(ah)"]
_V_COLS       = ["voltage(v)", "max_voltage(v)", "charge_voltage(v)"]
_VMIN_COLS    = ["min_voltage(v)", "discharge_voltage(v)"]
_ESR_COLS     = ["dcir(ohm)", "internal_resistance(ohm)", "esr(ohm)"]


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase + strip + replace spaces with underscores."""
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    return df


def _first_col(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    for c in candidates:
        if c in df.columns:
            return c
    return None


def _read_file(content: bytes, filename: str) -> pd.DataFrame:
    name = filename.lower()
    if name.endswith(".csv"):
        # Arbin CSVs sometimes have metadata rows before the real header
        text = content.decode("utf-8", errors="replace")
        lines = text.splitlines()
        header_idx = next(
            (i for i, l in enumerate(lines)
             if "cycle_index" in l.lower() or "cycle index" in l.lower()),
            0
        )
        df = pd.read_csv(io.StringIO("\n".join(lines[header_idx:])))
    elif name.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    else:
        raise ValueError(f"Unsupported file type: {filename}")
    return _normalise_columns(df)


def parse(content: bytes, filename: str) -> list[dict]:
    """Main entry-point. Returns list of per-cycle metric dicts."""
    df = _read_file(content, filename)

    cycle_col  = _first_col(df, _CYCLE_COLS)
    dch_col    = _first_col(df, _DCH_CAP_COLS)
    chg_col    = _first_col(df, _CHG_CAP_COLS)
    v_col      = _first_col(df, _V_COLS)
    vmin_col   = _first_col(df, _VMIN_COLS)
    esr_col    = _first_col(df, _ESR_COLS)

    if cycle_col is None:
        raise ValueError("Could not find Cycle_Index column in file.")

    df[cycle_col] = pd.to_numeric(df[cycle_col], errors="coerce")
    df = df.dropna(subset=[cycle_col])
    df[cycle_col] = df[cycle_col].astype(int)

    results = []
    for cycle, group in df.groupby(cycle_col):
        def _max_col(col):
            if col and col in group.columns:
                vals = pd.to_numeric(group[col], errors="coerce").dropna()
                return float(vals.max()) if len(vals) else None
            return None

        def _min_col(col):
            if col and col in group.columns:
                vals = pd.to_numeric(group[col], errors="coerce").dropna()
                return float(vals.min()) if len(vals) else None
            return None

        def _mean_col(col):
            if col and col in group.columns:
                vals = pd.to_numeric(group[col], errors="coerce").dropna()
                return float(vals.mean()) if len(vals) else None
            return None

        d_cap_ah = _max_col(dch_col)
        c_cap_ah = _max_col(chg_col)
        d_cap_mah = d_cap_ah * 1000 if d_cap_ah is not None else None
        c_cap_mah = c_cap_ah * 1000 if c_cap_ah is not None else None

        ce = None
        if d_cap_mah is not None and c_cap_mah is not None and c_cap_mah > 0:
            ce = (d_cap_mah / c_cap_mah) * 100

        v_max = _max_col(v_col)
        v_min = _min_col(vmin_col) if vmin_col else _min_col(v_col)
        v_mid = None
        if v_max is not None and v_min is not None:
            v_mid = (v_max + v_min) / 2
        elif v_max is not None:
            v_mid = v_max
        elif v_min is not None:
            v_mid = v_min

        esr_ohm  = _mean_col(esr_col)
        esr_mohm = esr_ohm * 1000 if esr_ohm is not None else None

        if d_cap_mah is None:
            continue   # skip cycles with no discharge data

        results.append({
            "cycle":               int(cycle),
            "discharge_cap_mah":   round(d_cap_mah, 4) if d_cap_mah is not None else None,
            "charge_cap_mah":      round(c_cap_mah, 4) if c_cap_mah is not None else None,
            "coulombic_efficiency": round(ce, 4)        if ce is not None else None,
            "voltage_max":         round(v_max, 5)      if v_max is not None else None,
            "voltage_min":         round(v_min, 5)      if v_min is not None else None,
            "voltage_mid":         round(v_mid, 5)      if v_mid is not None else None,
            "esr_mohm":            round(esr_mohm, 4)   if esr_mohm is not None else None,
        })

    return sorted(results, key=lambda x: x["cycle"])
