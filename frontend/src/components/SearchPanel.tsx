"use client";

import { useState } from "react";

const INVALID_QUERY_TRIGGER = "The input provided is not recognized";

export default function SearchPanel({ repositoryName }: { repositoryName: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [aiExplanation, setAiExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isInvalidQuery = aiExplanation.includes(INVALID_QUERY_TRIGGER);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (query.trim().length < 3) {
      setError("Please submit a more specific technical question.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResults([]);
    setAiExplanation("");

    try {
      const token = localStorage.getItem("token");
      
      const requestHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      };
      
      const requestBody = JSON.stringify({
        repository_name: repositoryName,
        query: query,
        limit: 5,
      });

      // 1. Launch BOTH requests concurrently for a true RAG experience
      const searchPromise = fetch("http://localhost:8000/search/", {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      });

      const chatPromise = fetch("http://localhost:8000/search/chat", {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      });

      // 2. Resolve the raw chunks immediately without blocking the AI stream
      searchPromise
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setResults(data.results || []);
          }
        })
        .catch((err) => console.error("Error fetching chunks:", err));

      // 3. Await and process the chat stream token by token
      const chatRes = await chatPromise;
      
      if (!chatRes.ok) throw new Error("Failed to connect to LLM.");
      if (!chatRes.body) throw new Error("No readable stream available.");

      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setAiExplanation((prev) => prev + chunk);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong while searching the codebase.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-gray-900 p-6 rounded-lg shadow-lg border border-gray-800">
      <form onSubmit={handleSearch} className="flex gap-4 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., How is the database connection handled?"
          className="flex-1 p-3 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {/* AI Explanation Box */}
      {(aiExplanation || isLoading) && (
        <div
          className={`mb-6 p-5 rounded leading-relaxed border transition-colors ${
            isInvalidQuery
              ? "bg-amber-950/30 border-amber-800 text-amber-200"
              : "bg-blue-900/30 border-blue-800 text-blue-100"
          }`}
        >
          <h3
            className={`font-semibold mb-2 flex items-center gap-2 ${
              isInvalidQuery ? "text-amber-400" : "text-blue-400"
            }`}
          >
            AI Analysis
            {isLoading && !aiExplanation && <span className="animate-pulse">...</span>}
          </h3>
          <p className="whitespace-pre-wrap">{aiExplanation}</p>
        </div>
      )}

      {/* Raw Code Chunks: Conditionally rendered only if valid question was answered */}
      {!isInvalidQuery && results.length > 0 && (
        <div className="space-y-6">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Referenced Code Chunks ({results.length})
          </h4>
          {results.map((result, index) => (
            <div
              key={index}
              className="bg-gray-800 rounded border border-gray-700 overflow-hidden"
            >
              <div className="bg-gray-950 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                <span className="text-sm font-mono text-blue-400">{result.file_path}</span>
                <span className="text-xs text-gray-500">Match #{index + 1}</span>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-300">
                  <code>{result.content}</code>
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isInvalidQuery && results.length === 0 && !isLoading && !error && !aiExplanation && (
        <p className="text-gray-500 italic">No results yet. Ask a question to search the repository.</p>
      )}
    </div>
  );
}