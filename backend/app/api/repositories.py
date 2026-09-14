import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domain.models import User, Repository, RepositoryStatus
from app.domain.schemas import RepositoryImport, RepositoryResponse
from app.api.deps import get_current_user

# Import the background task we just created
from app.tasks.indexing import clone_and_index_repo

router = APIRouter(prefix="/repos", tags=["repositories"])

@router.get("/github")
async def list_github_repositories(current_user: User = Depends(get_current_user)):
    """Fetch repositories directly from GitHub for the logged-in user."""
    if not current_user.access_token:
        raise HTTPException(status_code=400, detail="No GitHub access token found for user")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user/repos",
            headers={
                "Authorization": f"Bearer {current_user.access_token}",
                "Accept": "application/vnd.github.v3+json"
            },
            params={"sort": "updated", "per_page": 50, "visibility": "all"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch repositories from GitHub")
            
        repos = response.json()
        
        return [
            {
                "id": repo["id"],
                "name": repo["name"],
                "full_name": repo["full_name"],
                "private": repo["private"],
                "html_url": repo["html_url"],
                "description": repo["description"]
            }
            for repo in repos
        ]

@router.post("/import", response_model=RepositoryResponse)
async def import_repository(
    repo_in: RepositoryImport, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a GitHub repository to the database to begin indexing."""
    
    # Check if we already imported this repository
    existing_repo = db.query(Repository).filter(
        Repository.full_name == repo_in.full_name,
        Repository.user_id == current_user.id
    ).first()

    if existing_repo:
        return existing_repo

    # Create a new repository record
    new_repo = Repository(
        user_id=current_user.id,
        name=repo_in.name,
        full_name=repo_in.full_name,
        branch=repo_in.branch,
        status=RepositoryStatus.PENDING
    )
    
    db.add(new_repo)
    db.commit()
    db.refresh(new_repo)
    
    # Trigger the background worker! 
    # .delay() tells Celery to add this to the Redis queue and run it asynchronously
    clone_and_index_repo.delay(new_repo.id)
    
    return new_repo