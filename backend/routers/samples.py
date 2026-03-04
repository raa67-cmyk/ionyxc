from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import uuid

router = APIRouter()

# ── Simple in-memory store ────────────────────────────────────────────────
_store: Dict[str, Any] = {}


def save_sample(data: dict) -> str:
    sid = str(uuid.uuid4())
    _store[sid] = data
    return sid


def get_sample(sid: str) -> dict:
    return _store.get(sid)


def all_samples() -> list:
    return [{"id": k, **{kk: v for kk, v in vv.items() if kk != "metrics"}}
            for k, vv in _store.items()]


@router.get("/")
def list_samples():
    return {"samples": all_samples()}


@router.get("/{sample_id}")
def get_sample_route(sample_id: str):
    s = get_sample(sample_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sample not found.")
    return s


@router.delete("/{sample_id}")
def delete_sample(sample_id: str):
    if sample_id not in _store:
        raise HTTPException(status_code=404, detail="Sample not found.")
    del _store[sample_id]
    return {"deleted": sample_id} 
