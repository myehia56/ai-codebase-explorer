"use client";

import { useEffect, useState } from "react";
import SearchPanel from "@/components/SearchPanel"; 

export default function DashboardPage() {
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Public repo state
  const [publicUrl, setPublicUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const fetchRepositories = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/"; 
        return;
      }

      // 1. Fetch private GitHub repos
      const githubRes = await fetch("http://localhost:8000/repos/github", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (githubRes.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/"; 
        return;
      }
      const githubData = githubRes.ok ? await githubRes.json() : [];

      // 2. Fetch local imported repos (to grab the public ones)
      const localRes = await fetch("http://localhost:8000/repos/local", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const localData = localRes.ok ? await localRes.json() : [];

      // 3. Merge them: Add public repos that aren't in the GitHub list
      const githubFullNames = new Set(githubData.map((r: any) => r.full_name));
      const importedPublicRepos = localData
        .filter((r: any) => !githubFullNames.has(r.full_name))
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          private: false,
          description: "Imported public repository."
        }));

      setRepos([...githubData, ...importedPublicRepos]);
    } catch (err) {
      console.error(err);
      setError("Failed to load repositories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
  }, []);

  const handlePublicImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicUrl.trim()) return;

    setIsImporting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8000/repos/import/public", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: publicUrl.trim(), branch: "main" })
      });

      if (!response.ok) throw new Error("Failed to import public repository");
      
      setPublicUrl("");
      await fetchRepositories(); // Refresh the grid to show the new public repo
    } catch (err) {
      console.error(err);
      alert("Error importing repository. Check the console.");
    } finally {
      setIsImporting(false);
    }
  };

  const handlePrivateImport = async (repo: any) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8000/repos/import", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          name: repo.name,
          full_name: repo.full_name,
          branch: "main" 
        })
      });
      if (!response.ok) throw new Error("Failed to import private repository");
      alert("Import started in the background!");
    } catch (err) {
      console.error(err);
      alert("Failed to start import.");
    }
  };

  if (selectedRepo) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] text-white p-8">
        <button 
          onClick={() => setSelectedRepo(null)}
          className="mb-6 text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          ← Back to Repositories
        </button>
        <h1 className="text-2xl font-bold mb-2">{selectedRepo}</h1>
        <SearchPanel repositoryName={selectedRepo} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Repositories</h1>
        <button 
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/";
          }}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-semibold transition-colors"
        >
          Log Out
        </button>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Public Repo Importer */}
        <form onSubmit={handlePublicImport} className="mb-10 flex gap-4 bg-[#111827] p-4 rounded-lg border border-gray-800">
          <input
            type="url"
            value={publicUrl}
            onChange={(e) => setPublicUrl(e.target.value)}
            placeholder="Paste a public Git URL (e.g., https://github.com/tiangolo/fastapi.git)"
            className="flex-1 p-3 rounded bg-[#0a0f1c] border border-gray-700 text-white focus:outline-none focus:border-blue-500"
            required
          />
          <button
            type="submit"
            disabled={isImporting}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded disabled:opacity-50 transition-colors"
          >
            {isImporting ? "Importing..." : "Add Public Repo"}
          </button>
        </form>

        {/* Grid Layout */}
        {loading ? (
          <p className="text-gray-400">Loading repositories...</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : repos.length === 0 ? (
          <p className="text-gray-400">No repositories found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {repos.map((repo, index) => (
              <div key={index} className="bg-[#111827] border border-gray-800 rounded-lg p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold truncate pr-4" title={repo.name}>
                    {repo.name}
                  </h3>
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                    {repo.private ? "Private" : "Public"}
                  </span>
                </div>
                
                <p className="text-sm text-gray-400 mb-6 flex-1">
                  {repo.description || "No description provided."}
                </p>
                
                <div className="flex gap-3 mt-auto">
                  <button 
                    onClick={() => handlePrivateImport(repo)}
                    className="flex-1 bg-white hover:bg-gray-200 text-black font-medium py-2 rounded transition-colors"
                  >
                    Import
                  </button>
                  <button 
                    onClick={() => setSelectedRepo(repo.full_name)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition-colors"
                  >
                    Search
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}