import os
import logging
import traceback
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
    """Slices a raw code file and embeds it safely using micro-batches."""
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
    
    # Process in micro-batches of 10 to speed things up safely
    batch_size = 10
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        texts = [chunk.page_content for chunk in batch]
        
        try:
            # embed_documents is much faster than embed_query in a loop
            embeddings = embedder.embed_documents(texts)
            
            for chunk, emb in zip(batch, embeddings):
                db_chunks.append(
                    CodeChunk(
                        file_id=db_file.id,
                        content=chunk.page_content,
                        embedding=emb
                    )
                )
        except Exception as e:
            print(f"CRITICAL OLLAMA ERROR in batch: {str(e)}")
            # If a batch fails, we fall back to doing it one-by-one to salvage the safe chunks
            for chunk in batch:
                try:
                    emb = embedder.embed_query(chunk.page_content)
                    db_chunks.append(
                        CodeChunk(
                            file_id=db_file.id,
                            content=chunk.page_content,
                            embedding=emb
                        )
                    )
                except Exception as inner_e:
                    print(f"SKIPPED CHUNK. Ollama connection or context error: {inner_e}")
                    continue

    if db_chunks:
        try:
            db_session.add_all(db_chunks)
            db_session.commit()
            print(f"Successfully saved {len(db_chunks)} chunks for {db_file.file_path}")
        except Exception as db_err:
            db_session.rollback()
            print(f"Database save failed for {db_file.file_path}: {db_err}")