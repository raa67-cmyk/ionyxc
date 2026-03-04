from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import upload, samples

app = FastAPI(
    title="IONYX·C API",
    description="MXene coin cell battery analytics backend. Parses Arbin CSV/XLSX exports and returns computed metrics.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,  prefix="/api/upload",  tags=["Upload"])
app.include_router(samples.router, prefix="/api/samples", tags=["Samples"])


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
