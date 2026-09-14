from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from langchain_ollama import OllamaEmbeddings
from app.domain.models import CodeChunk

# Establish the connection to your local laptop's GPU!
# Docker uses "host.docker.internal" to securely talk to the host machine
embedder = OllamaEmbeddings(
    model="nomic-embed-text",
    base_url="http://host.docker.internal:11434"
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
    """Slices a raw code file and uses a local AI model to generate vector embeddings."""
    
    lc_language = LANGUAGE_MAP.get(db_file.language)
    
    if lc_language:
        splitter = RecursiveCharacterTextSplitter.from_language(
            language=lc_language, chunk_size=1000, chunk_overlap=200
        )
    else:
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    chunks = splitter.create_documents([db_file.content])
    
    for chunk in chunks:
        # --- THE REAL AI IN ACTION ---
        # This sends the snippet of code to your RTX 3050 to be mathematically mapped
        real_embedding = embedder.embed_query(chunk.page_content)
        
        db_chunk = CodeChunk(
            file_id=db_file.id,
            content=chunk.page_content,
            embedding=real_embedding
        )
        db_session.add(db_chunk)
    
    db_session.commit()