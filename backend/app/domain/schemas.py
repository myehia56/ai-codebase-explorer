from pydantic import BaseModel

class RepositoryImport(BaseModel):
    name: str
    full_name: str
    branch: str = "main"

class RepositoryResponse(BaseModel):
    id: int
    name: str
    full_name: str
    status: str

    class Config:
        from_attributes = True