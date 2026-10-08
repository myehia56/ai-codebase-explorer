import os
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from langchain_ollama import OllamaEmbeddings
from app.domain.models import CodeChunk

# Read Ollama URL dynamically from docker-compose / .env with fallback
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")

embedder = OllamaEmbeddings(
    model="nomic-embed-text",
    base_url=OLLAMA_BASE_URL
)

LANGUAGE_MAP = {
    "python": Language.PYTHON,
    "javascript": Language.JS,
    "typescript": Language.TS,
    "typescriptreact": Language.TS,
    "go": Language.GO,
    "rust": Language.RUST,
    "java": Language.JAVA,
    "cpp": Language.CPP,
    "csharp": Language.CSHARP,
}

def process_file_into_chunks(db_file, db_session):
    """Slices a raw code file and batches vector embedding generation."""
    if not db_file.content or not db_file.content.strip():
        return

    # Normalize language string to match the map safely
    lang_key = db_file.language.lower() if db_file.language else None
    lc_language = LANGUAGE_MAP.get(lang_key)
    
    if lc_language:
        splitter = RecursiveCharacterTextSplitter.from_language(
            language=lc_language, chunk_size=1000, chunk_overlap=200
        )
    else:
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    chunks = splitter.create_documents([db_file.content])
    if not chunks:
        return

    chunk_texts = [c.page_content for c in chunks]

    # Batch embedding: sends all chunks in one HTTP payload to Ollama
    # instead of serial round-trips per chunk
    embeddings = embedder.embed_documents(chunk_texts)

    db_chunks = [
        CodeChunk(
            file_id=db_file.id,
            content=text,
            embedding=emb
        )
        for text, emb in zip(chunk_texts, embeddings)
    ]
    
    db_session.add_all(db_chunks)
    db_session.commit()