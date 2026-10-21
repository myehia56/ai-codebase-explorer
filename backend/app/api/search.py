import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.domain.models import CodeChunk, File, Repository
from fastapi.responses import StreamingResponse
from langchain_ollama import OllamaEmbeddings, OllamaLLM

router = APIRouter()

# Read Ollama URL dynamically to match Docker networking
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")

# Connect to your local Ollama instance
embedder = OllamaEmbeddings(
    model="nomic-embed-text",
    base_url=OLLAMA_BASE_URL
)

# Initialize the text model
llm = OllamaLLM(
    model="llama3", 
    base_url=OLLAMA_BASE_URL
)

class SearchRequest(BaseModel):
    repository_name: str
    query: str
    limit: int = 5

@router.post("/")
def search_codebase(request: SearchRequest, db: Session = Depends(get_db)):
    try:
        # FIX: Filter by full_name instead of name to match the frontend payload
        repo = db.query(Repository).filter(Repository.full_name == request.repository_name).first()
        
        if not repo:
            return {"results": []}

        query_vector = embedder.embed_query(request.query)

        results = (
            db.query(CodeChunk, File.path)
            .join(File)
            .filter(File.repository_id == repo.id)
            .order_by(CodeChunk.embedding.cosine_distance(query_vector))
            .limit(request.limit)
            .all()
        )

        response_data = []
        for chunk, file_path in results:
            response_data.append({
                "file_path": file_path,
                "content": chunk.content,
            })

        return {"results": response_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat_codebase(request: SearchRequest, db: Session = Depends(get_db)):
    # FIX: Filter by full_name instead of name to match the frontend payload
    repo = db.query(Repository).filter(Repository.full_name == request.repository_name).first()
    
    if not repo:
        raise HTTPException(status_code=404, detail=f"Repository '{request.repository_name}' not found")

    try:
        query_vector = embedder.embed_query(request.query)
        results = (
            db.query(CodeChunk, File.path)
            .join(File)
            .filter(File.repository_id == repo.id)
            .order_by(CodeChunk.embedding.cosine_distance(query_vector))
            .limit(request.limit)
            .all()
        )

        context_blocks = []
        for chunk, file_path in results:
            context_blocks.append(f"File: {file_path}\nCode:\n{chunk.content}")
        
        full_context = "\n\n".join(context_blocks)

        prompt = f"""You are an expert software architect. Answer the user's question about the codebase using the provided context below.
        
        CRITICAL INSTRUCTIONS:
        1. If the context contains the answer, explain it clearly and reference the specific files.
        2. If the context DOES NOT contain the answer (e.g., the user asks about a database, but no database configuration exists in this repository), DO NOT throw an error. Instead, politely explain that the requested feature or logic does not appear in the provided codebase context.
        3. ONLY reply exactly with "The input provided is not recognized as a valid technical inquiry." IF AND ONLY IF the user's input is pure random gibberish (like "asdfghjkl").
        
Context:
{full_context}

Question: {request.query}

Answer:"""

        def generate_response():
            for token in llm.stream(prompt):
                yield token

        return StreamingResponse(generate_response(), media_type="text/plain")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))