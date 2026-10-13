"use client";

import { useEffect, useState } from "react";
import SearchPanel from "@/components/SearchPanel"; 

export default function DashboardPage() {
  const [personalRepos, setPersonalRepos] = useState<any[]>([]);
  const [publicRepos, setPublicRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI Tabs & Actions
  const [activeTab, setActiveTab] = useState<"personal" | "public">("personal");
  const [publicUrl, setPublicUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

      // 3. Separate them cleanly
      const githubFullNames = new Set(githubData.map((r: any) => r.full_name));
      const importedPublicRepos = localData
        .filter((r: any) => !githubFullNames.has(r.full_name))
        .map((r: any) => ({
          ...r,
          private: false,
          description: "Imported public repository."
        }));

      setPersonalRepos(githubData);
      setPublicRepos(importedPublicRepos);
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
      setActiveTab("public"); // Switch to public tab automatically
      await fetchRepositories(); 
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

  const handleDeletePublicRepo = async (repoId: number) => {
    if (!confirm("Are you sure you want to delete this repository and all its analyzed code chunks?")) {
      return;
    }

    setDeletingId(repoId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/repos/${repoId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to delete repository");

      // Remove from UI immediately without needing a full refetch
      setPublicRepos((prev) => prev.filter((r) => r.id !== repoId));
    } catch (err) {
      console.error(err);
      alert("Error deleting repository. Ensure the backend is running.");
    } finally {
      setDeletingId(null);
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

  // Determine which list to show based on the active tab
  const currentRepos = activeTab === "personal" ? personalRepos : publicRepos;

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Codebase Explorer</h1>
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
        {/* Public Repo Importer Form */}
        <form onSubmit={handlePublicImport} className="mb-8 flex gap-4 bg-[#111827] p-4 rounded-lg border border-gray-800 shadow-sm">
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 gap-6 mb-6">
          <button
            onClick={() => setActiveTab("personal")}
            className={`pb-3 font-medium transition-colors border-b-2 ${
              activeTab === "personal"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            My GitHub Repositories ({personalRepos.length})
          </button>
          <button
            onClick={() => setActiveTab("public")}
            className={`pb-3 font-medium transition-colors border-b-2 ${
              activeTab === "public"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Imported Public Repositories ({publicRepos.length})
          </button>
        </div>

        {/* Grid Layout */}
        {loading ? (
          <p className="text-gray-400">Loading repositories...</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : currentRepos.length === 0 ? (
          <p className="text-gray-500 italic mt-8">
            {activeTab === "personal" 
              ? "No GitHub repositories found for your account." 
              : "No public repositories imported yet. Paste a URL above to get started."}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentRepos.map((repo, index) => (
              <div key={repo.id || index} className="bg-[#111827] border border-gray-800 rounded-lg p-6 flex flex-col hover:border-gray-700 transition-all shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold truncate pr-4 text-white" title={repo.name}>
                    {repo.name}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded border ${
                    repo.private 
                      ? "bg-purple-950/30 text-purple-400 border-purple-800/50" 
                      : "bg-emerald-950/30 text-emerald-400 border-emerald-800/50"
                  }`}>
                    {repo.private ? "Private" : "Public"}
                  </span>
                </div>
                
                <p className="text-sm text-gray-400 mb-6 flex-1 font-mono">
                  {repo.full_name}
                </p>
                
                {/* Action Buttons */}
                <div className="flex gap-3 mt-auto">
                  {activeTab === "personal" && (
                    <button 
                      onClick={() => handlePrivateImport(repo)}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 rounded transition-colors border border-gray-700"
                    >
                      Import
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setSelectedRepo(repo.full_name)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition-colors"
                  >
                    Search AI
                  </button>

                  {activeTab === "public" && (
                    <button 
                      onClick={() => handleDeletePublicRepo(repo.id)}
                      disabled={deletingId === repo.id}
                      className="flex-none px-4 bg-red-950/40 hover:bg-red-900/60 text-red-400 font-medium py-2 rounded transition-colors border border-red-900/50 disabled:opacity-50"
                    >
                      {deletingId === repo.id ? "..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}