import time
from app.worker import celery_app
from app.core.database import SessionLocal
from app.domain.models import Repository, RepositoryStatus

@celery_app.task(bind=True)
def clone_and_index_repo(self, repository_id: int):
    """Background task to download and process a GitHub repository."""
    db = SessionLocal()
    
    try:
        # 1. Fetch the repository from the database
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            return "Repository not found"
            
        # 2. Update status to INDEXING
        repo.status = RepositoryStatus.INDEXING
        db.commit()
        
        # TODO: In the next step, we will use the GitHub API to download the actual files here!
        print(f"--- STARTING MOCK INDEXING FOR: {repo.full_name} ---")
        time.sleep(5) # Simulating the time it takes to download files
        
        # 3. Update status to READY
        repo.status = RepositoryStatus.READY
        db.commit()
        print(f"--- FINISHED MOCK INDEXING FOR: {repo.full_name} ---")
        
        return "Success"
        
    except Exception as e:
        db.rollback()
        if repo:
            repo.status = RepositoryStatus.FAILED
            db.commit()
        raise e
    finally:
        db.close()