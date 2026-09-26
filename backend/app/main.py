from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import ALL your API routers here
from app.api import auth, repositories, search

app = FastAPI(title="AI Codebase Explorer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Auth router (Prefix removed to fix /auth/auth/github)
app.include_router(auth.router, tags=["auth"])

# 2. Repos router (Prefix removed to fix /repos/repos/github)
app.include_router(repositories.router, tags=["repositories"])

# 3. Search router (Keep this one, we wrote it from scratch without a prefix inside!)
app.include_router(search.router, prefix="/search", tags=["search"])