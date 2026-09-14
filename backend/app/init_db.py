from app.core.database import engine
from app.domain.models import Base
from sqlalchemy import text

def setup_database():
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    
    Base.metadata.create_all(bind=engine)
    print("--- SUCCESS: pgvector enabled and tables created ---")

if __name__ == "__main__":
    setup_database()