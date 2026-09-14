import io
import os
import zipfile
import httpx
from app.worker import celery_app
from app.core.database import SessionLocal
from app.domain.models import Repository, RepositoryStatus, File, User
from app.services.chunking import process_file_into_chunks

# We only want to save actual code, not images or binaries
SUPPORTED_EXTENSIONS = {
    ".py": "python", ".ts": "typescript", ".tsx": "typescriptreact",
    ".js": "javascript", ".jsx": "javascriptreact", ".go": "go",
    ".rs": "rust", ".java": "java", ".cpp": "cpp", ".c": "c",
    ".cs": "csharp", ".sql": "sql", ".md": "markdown"
}

IGNORED_DIRS = {"node_modules", ".git", ".next", "dist", "build", "venv", "__pycache__"}

@celery_app.task(bind=True)
def clone_and_index_repo(self, repository_id: int):
    """Downloads a repo zipball, extracts source files, and saves them to PostgreSQL."""
    db = SessionLocal()
    
    try:
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            return "Repository not found"

        user = db.query(User).filter(User.id == repo.user_id).first()
        repo.status = RepositoryStatus.INDEXING
        db.commit()

        # 1. Download the repository as a ZIP file directly into memory
        url = f"https://api.github.com/repos/{repo.full_name}/zipball"
        headers = {
            "Authorization": f"Bearer {user.access_token}",
            "Accept": "application/vnd.github.v3+json",
        }

        print(f"--- DOWNLOADING: {repo.full_name} ---")
        with httpx.Client(follow_redirects=True, timeout=60.0) as client:
            res = client.get(url, headers=headers)
            if res.status_code != 200:
                raise RuntimeError(f"GitHub returned HTTP {res.status_code}")

        # 2. Unzip and process files
        with zipfile.ZipFile(io.BytesIO(res.content)) as zip_ref:
            for zip_info in zip_ref.infolist():
                if zip_info.is_dir():
                    continue

                # Strip GitHub's auto-generated top-level directory folder
                path_parts = zip_info.filename.split("/", 1)
                if len(path_parts) < 2:
                    continue
                relative_path = path_parts[1]

                # 3. Filter out unwanted folders and file types
                if any(ignored in relative_path.split("/") for ignored in IGNORED_DIRS):
                    continue

                _, ext = os.path.splitext(relative_path)
                if ext.lower() not in SUPPORTED_EXTENSIONS:
                    continue

                # 4. Read the file text and save to PostgreSQL
                try:
                    with zip_ref.open(zip_info) as f:
                        content = f.read().decode("utf-8")
                except UnicodeDecodeError:
                    continue  # Skip unreadable binary files

                existing_file = db.query(File).filter(
                    File.repository_id == repo.id, File.path == relative_path
                ).first()

                if not existing_file:
                    db_file = File(
                        repository_id=repo.id,
                        path=relative_path,
                        language=SUPPORTED_EXTENSIONS[ext.lower()],
                        content=content
                    )
                    db.add(db_file)
                    db.commit() # Save the file first so it gets an ID
                    db.refresh(db_file)
                    
                    process_file_into_chunks(db_file, db)
                    

        repo.status = RepositoryStatus.READY
        db.commit()
        print(f"--- SUCCESS: Extracted and saved files for {repo.full_name} ---")
        return "Complete"

    except Exception as e:
        db.rollback()
        if repo:
            repo.status = RepositoryStatus.FAILED
            db.commit()
        print(f"--- ERROR: {str(e)} ---")
        raise e
    finally:
        db.close()