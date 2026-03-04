from fastapi import APIRouter, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel
import uuid

router = APIRouter()

_store = {}

class SamplePayload(BaseModel):
    id: Optional[str] = None
    label: str
    filename: Optional[str] = None
    metadata: Optional[dict] = {}
    metrics: Optional[List[Any]] = []

@router.post("/")
def save_sample(data: SamplePayload):
    sid = str(uuid.uuid4())[:8]
    _store[sid] = data.dict()
    return {"id": sid}

@router.get("/")
def list_samples():
    return {"samples": [{"id": k, "label": v.get("label"), "filename": v.get("filename")} for k, v in _store.items()]}

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
