# ⬡ IONYX·C — MXene Coin Cell Analytics

> **Battery intelligence platform for MXene electrochemical research.**  
> Upload Arbin exports → instantly see capacity cycling, ESR growth, voltage behavior, and coulombic efficiency — all in one dark, sci-fi UI.

![IONYX·C](https://img.shields.io/badge/IONYX·C-v1.0-00ffe7?style=for-the-badge&labelColor=03050a)
![License](https://img.shields.io/badge/license-MIT-ff3e6c?style=for-the-badge&labelColor=03050a)
![Python](https://img.shields.io/badge/Python-3.11+-00ffe7?style=for-the-badge&logo=python&labelColor=03050a)
![React](https://img.shields.io/badge/React-18-00ffe7?style=for-the-badge&logo=react&labelColor=03050a)

---

## Features

| Metric | Description |
|---|---|
| **Capacity** | Discharge & charge capacity per cycle (mAh) with retention % |
| **Voltage** | Vmax / Vmid / Vmin per cycle — tracks polarization drift |
| **Coulombic Efficiency** | Charge/discharge ratio per cycle; 1st cycle ICE highlighted |
| **ESR** | Equivalent Series Resistance from DCIR column (mΩ) — detects degradation |
| **Summary Table** | All metrics per sample in one exportable view |

- 📂 **Arbin CSV + XLSX** support (Neware / BioLogic coming soon)
- 🧪 **Multi-sample overlay** — compare up to 6 samples on the same chart
- 📋 **Metadata tagging** — Cell ID, MXene composition, electrode mass, electrolyte, date
- 🚀 **Modular parser architecture** — plug in new cycler formats with one file

---

## Repo Structure

```
ionyxc/
├── frontend/               # React + Vite app (deploys to GitHub Pages)
│   ├── src/
│   │   ├── App.jsx         # Main app — all charts, tabs, UI
│   │   └── main.jsx        # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── backend/                # FastAPI Python backend
│   ├── main.py             # App + CORS + routers
│   ├── requirements.txt
│   ├── parsers/
│   │   ├── __init__.py     # Parser registry (add new cyclers here)
│   │   └── arbin.py        # Arbin CSV/XLSX parser → per-cycle metrics
│   └── routers/
│       ├── upload.py       # POST /api/upload
│       └── samples.py      # GET/DELETE /api/samples
│
└── .github/
    └── workflows/
        └── deploy.yml      # Auto-deploy frontend to GitHub Pages on push
```

---

## Quick Start

### Frontend (local dev)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend (local dev)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000
# → API docs at http://localhost:8000/docs
```

---

## Deploying to GitHub Pages (frontend)

1. Push this repo to GitHub
2. Go to **Settings → Pages → Source → GitHub Actions**
3. The `deploy.yml` workflow will automatically build and deploy on every push to `main`
4. Your app will be live at: `https://<your-username>.github.io/ionyxc/`

> **Note:** Update `base` in `frontend/vite.config.js` to match your repo name.

---

## Deploying the Backend (Railway)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select the `backend/` folder as the root
3. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Update the frontend's API base URL to your Railway URL

---

## Adding a New Cycler Parser

1. Create `backend/parsers/neware.py` with a `parse(content: bytes, filename: str) -> list[dict]` function
2. Register it in `backend/parsers/__init__.py`:
   ```python
   from .neware import parse as parse_neware
   PARSERS = { "arbin": parse_arbin, "neware": parse_neware }
   ```
3. Pass `source=neware` in the upload form

---

## Arbin Column Mapping

| IONYX·C metric | Expected Arbin column |
|---|---|
| Cycle | `Cycle_Index` |
| Discharge capacity | `Discharge_Capacity(Ah)` or `Dchg_Capacity(Ah)` |
| Charge capacity | `Charge_Capacity(Ah)` or `Chg_Capacity(Ah)` |
| Voltage | `Voltage(V)` |
| ESR | `DCIR(Ohm)` or `Internal_Resistance(Ohm)` |

---

## License

MIT — free to use, modify, and deploy. If you build on this for a publication or product, a credit or citation is appreciated.

---

*Built for MXene electrochemical research. Designed to scale.*
