"use client";

import { useState } from "react";

export default function SearchPanel({ repositoryName }: { repositoryName: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [aiExplanation, setAiExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError("");
    setResults([]);
    setAiExplanation(""); // Clear previous chat

    try {
      // Get the auth token from local storage
      const token = localStorage.getItem("token");

      // 1. Fetch the raw code chunks (Your existing endpoint)
      const searchRes = await fetch("http://localhost:8000/search/", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ repository_name: repositoryName, query, limit: 5 }),
      });

      if (!searchRes.ok) throw new Error("Failed to fetch code chunks.");
      const searchData = await searchRes.json();
      setResults(searchData.results);

      // 2. Fetch the streaming AI explanation
      const chatRes = await fetch("http://localhost:8000/search/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ repository_name: repositoryName, query, limit: 5 }),
      });

      if (!chatRes.ok) throw new Error("Failed to connect to LLM.");
      if (!chatRes.body) throw new Error("No readable stream available.");

      // 3. Read the stream as it arrives
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
      <h2 className="text-xl font-bold text-red-500 mb-4">Querying: {repositoryName} - TESTING</h2>
      
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
        <div className="mb-6 p-5 bg-blue-900/30 border border-blue-800 rounded text-blue-100 leading-relaxed">
          <h3 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
            AI Analysis
            {isLoading && !aiExplanation && <span className="animate-pulse">...</span>}
          </h3>
          <p className="whitespace-pre-wrap">{aiExplanation}</p>
        </div>
      )}

      {/* Raw Code Chunks */}
      <div className="space-y-6">
        {results.map((result, index) => (
          <div key={index} className="bg-gray-800 rounded border border-gray-700 overflow-hidden">
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
        
        {results.length === 0 && !isLoading && !error && (
          <p className="text-gray-500 italic">No results yet. Ask a question to search the repository.</p>
        )}
      </div>
    </div>
  );
}