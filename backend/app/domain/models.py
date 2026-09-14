from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship, declarative_base
from pgvector.sqlalchemy import Vector
from datetime import datetime, timezone
import enum

Base = declarative_base()

class RepositoryStatus(str, enum.Enum):
    PENDING = "pending"
    INDEXING = "indexing"
    READY = "ready"
    FAILED = "failed"

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    github_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    avatar_url = Column(String)
    access_token = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    repositories = relationship("Repository", back_populates="owner")

class Repository(Base):
    __tablename__ = 'repositories'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    name = Column(String, nullable=False)
    full_name = Column(String, unique=True, nullable=False)
    branch = Column(String, default="main")
    status = Column(SQLEnum(RepositoryStatus), default=RepositoryStatus.PENDING)
    owner = relationship("User", back_populates="repositories")
    files = relationship("File", back_populates="repository")

class File(Base):
    __tablename__ = 'files'
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey('repositories.id'))
    path = Column(String, nullable=False)
    language = Column(String)
    content = Column(Text)
    repository = relationship("Repository", back_populates="files")
    chunks = relationship("CodeChunk", back_populates="file")

class CodeChunk(Base):
    __tablename__ = 'code_chunks'
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey('files.id'))
    start_line = Column(Integer)
    end_line = Column(Integer)
    symbol_name = Column(String)
    
    # 1536 dimensions for standard OpenAI embedding models
    embedding = Column(Vector(1536))
    file = relationship("File", back_populates="chunks")