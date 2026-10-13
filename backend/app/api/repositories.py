import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domain.models import User, Repository, RepositoryStatus, File, CodeChunk
from app.domain.schemas import RepositoryImport, RepositoryResponse
from app.api.deps import get_current_user

# Import the background task we just created
from app.tasks.indexing import clone_and_index_repo

router = APIRouter(prefix="/repos", tags=["repositories"])

# Schema for the new public import route
class PublicRepoRequest(BaseModel):
    url: str
    branch: str = "main"

@router.get("/local")
async def list_local_repositories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch all repositories (private and public) imported into the local database."""
    repos = db.query(Repository).filter(Repository.user_id == current_user.id).all()
    return repos

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
    """Save a private GitHub repository to the database to begin indexing."""
    
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
    clone_and_index_repo.delay(new_repo.id)
    
    return new_repo

@router.post("/import/public", response_model=RepositoryResponse)
async def import_public_repository(
    request: PublicRepoRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a public Git repository via URL to the database and begin indexing."""
    
    # Clean up the URL to extract a predictable full_name (e.g. https://github.com/tiangolo/fastapi.git -> tiangolo/fastapi)
    clean_url = request.url.rstrip("/")
    if clean_url.endswith(".git"):
        clean_url = clean_url[:-4]
        
    parts = clean_url.split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid Git URL format. Must include owner and repo.")
        
    repo_name = parts[-1]
    full_name = f"{parts[-2]}/{parts[-1]}"

    # Check if we already imported this repository
    existing_repo = db.query(Repository).filter(
        Repository.full_name == full_name,
        Repository.user_id == current_user.id
    ).first()

    if existing_repo:
        return existing_repo

    # Create a new repository record for the public code
    new_repo = Repository(
        user_id=current_user.id,
        name=repo_name,
        full_name=full_name,
        branch=request.branch,
        status=RepositoryStatus.PENDING
    )
    
    db.add(new_repo)
    db.commit()
    db.refresh(new_repo)
    
    # Hand off to the exact same Celery worker used for private repos
    clone_and_index_repo.delay(new_repo.id)
    
    return new_repo

@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repository(
    repo_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a repository and all its associated files and vector chunks."""
    
    # Ensure the repository exists and belongs to the current user
    repo = db.query(Repository).filter(
        Repository.id == repo_id,
        Repository.user_id == current_user.id
    ).first()
    
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    try:
        # 1. Find all files associated with this repository
        file_ids = [f.id for f in db.query(File.id).filter(File.repository_id == repo.id).all()]
        
        # 2. Delete all vector chunks associated with those files
        if file_ids:
            db.query(CodeChunk).filter(CodeChunk.file_id.in_(file_ids)).delete(synchronize_session=False)

        # 3. Delete the files
        db.query(File).filter(File.repository_id == repo.id).delete(synchronize_session=False)

        # 4. Delete the repository itself
        db.delete(repo)
        db.commit()
        
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))