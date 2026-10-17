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
    """Slices a raw code file and embeds it safely using micro-batches."""
    try:
        if not getattr(db_file, 'content', None) or not db_file.content.strip():
            return

        lang_key = db_file.language.lower() if getattr(db_file, 'language', None) else None
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
        
        batch_size = 10
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            texts = [chunk.page_content for chunk in batch]
            
            try:
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
                logger.warning(f"CRITICAL OLLAMA ERROR in batch: {str(e)}")
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
                        logger.warning(f"SKIPPED CHUNK. Ollama connection or context error: {inner_e}")
                        continue

        # This is now safely indented INSIDE the function
        if db_chunks:
            try:
                db_session.add_all(db_chunks)
                db_session.commit()
                logger.info(f"Successfully saved {len(db_chunks)} chunks for file ID: {db_file.id}")
            except Exception as db_err:
                db_session.rollback()
                logger.error(f"Database save failed for file ID: {db_file.id}: {db_err}")
                
    except Exception as general_err:
        file_identifier = getattr(db_file, 'id', 'Unknown')
        logger.error(f"Unexpected error processing file ID {file_identifier}: {general_err}")