from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import uuid

router = APIRouter()

_store: Dict[str, Any] = {}

@router.post("/")
def save_sample(data: dict):
    sid = str(uuid.uuid4())[:8]
    _store[sid] = data
    return {"id": sid}

@router.get("/")
def list_samples():
    return {"samples": [{"id": k, **{kk: vv for kk, vv in v.items() if kk != "metrics"}} for k, v in _store.items()]}

@router.get("/{sample_id}")
def get_sample_route(sample_id: str):
    s = _store.get(sample_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sample not found.")
    return s

@router.delete("/{sample_id}")
def delete_sample(sample_id: str):
    if sample_id not in _store:
        raise HTTPException(status_code=404, detail="Sample not found.")
    del _store[sample_id]
    return {"deleted": sample_id}
