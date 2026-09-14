from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Import our new auth routes
from app.api import auth
from app.api import repositories

app = FastAPI(title="AI Codebase Explorer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach the auth routes to the main application
app.include_router(auth.router)
app.include_router(repositories.router)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "backend"}