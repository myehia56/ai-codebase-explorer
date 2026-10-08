import os
import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from langchain_ollama import OllamaEmbeddings
from app.domain.models import CodeChunk

logger = logging.getLogger(__name__)
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
    """Slices a raw code file and embeds it safely, skipping chunks that crash the LLM."""
    if not db_file.content or not db_file.content.strip():
        return

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

    db_chunks = []
    
    # Process individually with a safety net so one bad file doesn't nuke the import
    for chunk in chunks:
        try:
            emb = embedder.embed_query(chunk.page_content)
            db_chunks.append(
                CodeChunk(
                    file_id=db_file.id,
                    content=chunk.page_content,
                    embedding=emb
                )
            )
        except Exception as e:
            logger.warning(f"Skipped a chunk due to Ollama error: {e}")
            continue

    if db_chunks:
        db_session.add_all(db_chunks)
        db_session.commit()