"""
POST /api/upload
────────────────
Accepts a multipart form with:
  file      : UploadFile  (.csv or .xlsx)
  source    : str         parser to use (default: "arbin")
  cell_id   : str
  composition: str
  mass_mg   : str
  electrolyte: str
  date      : str

Returns computed per-cycle metrics as JSON.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from parsers import get_parser

router = APIRouter()


@router.post("/")
async def upload_file(
    file:        UploadFile = File(...),
    source:      str = Form("arbin"),
    cell_id:     str = Form(""),
    composition: str = Form(""),
    mass_mg:     str = Form(""),
    electrolyte: str = Form(""),
    date:        str = Form(""),
):
    content = await file.read()

    try:
        parser  = get_parser(source)
        metrics = parser(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")

    if not metrics:
        raise HTTPException(status_code=422, detail="No valid cycle data found in file.")

    return {
        "filename": file.filename,
        "source":   source,
        "metadata": {
            "cell_id":     cell_id,
            "composition": composition,
            "mass_mg":     mass_mg,
            "electrolyte": electrolyte,
            "date":        date,
        },
        "cycle_count": len(metrics),
        "metrics":     metrics,
    }
