# AI Codebase Explorer

An intelligent, full-stack developer tool that enables semantic search and conversational querying across GitHub repositories. By leveraging Retrieval-Augmented Generation (RAG) and local Large Language Models (LLMs), this application allows developers to import codebases and instantly search for functions, architecture patterns, and logic without relying on exact keyword matches.

All AI processing runs locally, ensuring that proprietary or private codebase data is never transmitted to third-party APIs.

## System Architecture & Tech Stack

This project is built with a decoupled, containerized microservices architecture:

*   **Frontend (Next.js 14, Tailwind CSS, Lucide React):** A responsive, glassmorphism-styled dashboard featuring a multi-pane interface for managing imported repositories and streaming real-time LLM responses.
*   **Backend (FastAPI, Python):** A high-performance REST API that handles GitHub webhooks, orchestrates the RAG pipeline, and streams Ollama generation responses back to the client.
*   **Vector Database (PostgreSQL + pgvector):** Stores mathematical representations (embeddings) of code chunks. `pgvector` enables lighting-fast cosine similarity searches to find the most relevant code snippets based on user queries.
*   **Task Queue (Redis + Celery):** Manages asynchronous background processing. When a large repository is imported, Celery workers handle the heavy lifting of cloning, chunking, and embedding the code without blocking the main backend thread.
*   **AI Engine (Ollama):** Hosts the local LLM (e.g., Llama 3) for generating context-aware answers based on the retrieved code vectors.

## Key Features
*   **Semantic Code Search:** Ask questions like *"How does the authentication middleware work?"* and receive accurate answers, even if the word "authentication" is never used in the code.
*   **Public & Private Imports:** Securely ingest both public Git URLs and private GitHub repositories linked to your account.
*   **100% Local AI:** Guarantees zero data leakage by running the embedding models and generative LLMs entirely on local hardware.
*   **Optimistic UI:** Fluid, reactive dashboard that instantly updates repository states without waiting for slow database polling.

---

## Local Setup & Installation

### 1. Prerequisites
Ensure you have the following installed on your host machine:
*   [Docker](https://www.docker.com/) & Docker Compose
*   [Node.js](https://nodejs.org/) (v18+ recommended)
*   [Ollama](https://ollama.com/) (Must be running natively on your OS)

### 2. Environment Configuration
Clone the repository and set up your local environment variables.
```bash
git clone [https://github.com/yourusername/ai-codebase-explorer.git](https://github.com/yourusername/ai-codebase-explorer.git)
cd ai-codebase-explorer
cp .env.example .env