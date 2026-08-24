import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.config import BASE_DIR, STATIC_DIR, UPLOADS_DIR
from backend.database import init_db
from backend.seed_data import seed_database
from backend.routes_auth import router as auth_router
from backend.routes_complaints import router as complaints_router
from backend.routes_analytics import router as analytics_router
from backend.routes_notifications import router as notifications_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB & seed realistic smart city data on startup
    init_db()
    seed_database(force_reseed=False)
    yield

app = FastAPI(
    title="Civic AI Construction & Infrastructure Platform",
    description="AI-Powered civic issue detection, assignment, tracking, and resolution platform",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router)
app.include_router(complaints_router)
app.include_router(analytics_router)
app.include_router(notifications_router)

# Mount Uploads directory
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Mount Static directory
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Civic AI Platform",
        "version": "2.0.0",
        "ai_engine": "ModularCivicVision-v2.6"
    }

@app.post("/api/demo/reseed")
def reseed_api():
    """Reseed demo data on demand"""
    seed_database(force_reseed=True)
    return {"success": True, "message": "Civic AI platform demo dataset reset to initial state."}

# Serve Single Page Application frontend
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # If path points to an existing file in static, serve it
    static_file = STATIC_DIR / full_path
    if full_path and static_file.is_file():
        return FileResponse(static_file)
        
    # Default fallback to index.html for client-side routing
    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
        
    return JSONResponse(status_code=404, content={"message": "Frontend not found"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
