"use client";

import { useState } from "react";

export default function SearchPanel({ repositoryId }: { repositoryId: number }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError("");
    setResults([]);

    try {
      const response = await fetch("http://localhost:8000/search/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repository_id: repositoryId,
          query: query,
          limit: 5,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch search results.");
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while searching the codebase.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-gray-900 p-6 rounded-lg shadow-lg border border-gray-800">
      <h2 className="text-xl font-bold text-white mb-4">Query Codebase</h2>
      
      {/* Search Form */}
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

      {/* Error Message */}
      {error && <p className="text-red-400 mb-4">{error}</p>}

      {/* Results Display */}
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