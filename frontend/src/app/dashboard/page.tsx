"use client";

import { useEffect, useState } from "react";
import SearchPanel from "@/components/SearchPanel"; 
import { 
  LogOut, GitBranch, Plus, Search, FolderGit2, 
  BookMarked, Code2, ArrowLeft, Trash2, Loader2, Sparkles 
} from "lucide-react";

export default function DashboardPage() {
  const [personalRepos, setPersonalRepos] = useState<any[]>([]);
  const [publicRepos, setPublicRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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

      const githubRes = await fetch("http://localhost:8000/repos/github", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (githubRes.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/"; 
        return;
      }
      const githubData = githubRes.ok ? await githubRes.json() : [];

      const localRes = await fetch("http://localhost:8000/repos/local", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const localData = localRes.ok ? await localRes.json() : [];

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
      setActiveTab("public"); 
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
      setPublicRepos((prev) => prev.filter((r) => r.id !== repoId));
    } catch (err) {
      console.error(err);
      alert("Error deleting repository. Ensure the backend is running.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (selectedRepo) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none"></div>
        <nav className="border-b border-neutral-800/60 bg-neutral-950/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
            <button 
              onClick={() => setSelectedRepo(null)}
              className="flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
          <SearchPanel repositoryName={selectedRepo} />
        </div>
      </div>
    );
  }

  const currentRepos = activeTab === "personal" ? personalRepos : publicRepos;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-indigo-500/30 relative overflow-hidden">
      
      {/* Lively Background Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[40%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[50%] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Top Navigation */}
      <nav className="border-b border-white/5 bg-neutral-950/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-xl border border-white/10 group-hover:border-indigo-500/30 transition-all shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <Code2 className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400 tracking-tight">
              Codebase Explorer
            </h1>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12 relative z-10">
        
        {/* URL Import Section */}
        <section className="p-8 bg-neutral-900/40 backdrop-blur-sm border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <label className="block text-sm font-medium text-neutral-300 mb-4 ml-1 flex items-center gap-2 relative z-10">
            <FolderGit2 className="w-4 h-4 text-indigo-400" />
            Import Public Repository
          </label>
          <form onSubmit={handlePublicImport} className="flex flex-col sm:flex-row gap-4 relative z-10">
            <input 
              type="url" 
              value={publicUrl}
              onChange={(e) => setPublicUrl(e.target.value)}
              placeholder="Paste a public Git URL (e.g., https://github.com/tiangolo/fastapi.git)"
              required
              className="flex-1 bg-neutral-950/50 border border-white/10 text-white rounded-xl px-5 py-3.5 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-neutral-600"
            />
            <button 
              type="submit"
              disabled={isImporting}
              className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isImporting ? "Importing..." : "Add Repository"}
            </button>
          </form>
        </section>

        {/* Tabs & Grid Section */}
        <section>
          <div className="flex gap-8 border-b border-white/5 mb-8">
            <button 
              onClick={() => setActiveTab("personal")}
              className={`pb-4 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
                activeTab === "personal" 
                  ? "border-indigo-500 text-indigo-400" 
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <GitBranch className="w-4 h-4" />
              My GitHub Repositories
              <span className={`py-0.5 px-2.5 rounded-full text-xs ml-1 ${activeTab === 'personal' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-neutral-400'}`}>
                {personalRepos.length}
              </span>
            </button>
            <button 
              onClick={() => setActiveTab("public")}
              className={`pb-4 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
                activeTab === "public" 
                  ? "border-indigo-500 text-indigo-400" 
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <BookMarked className="w-4 h-4" />
              Imported Public
              <span className={`py-0.5 px-2.5 rounded-full text-xs ml-1 ${activeTab === 'public' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-neutral-400'}`}>
                {publicRepos.length}
              </span>
            </button>
          </div>

          {/* Grid Loading / Error / Empty States */}
          {loading ? (
            <div className="flex items-center gap-3 text-indigo-400 py-20 justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-neutral-400 font-medium">Fetching repositories...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm text-center flex items-center justify-center gap-2">
              <span>{error}</span>
            </div>
          ) : currentRepos.length === 0 ? (
            <div className="py-24 text-center border border-white/5 bg-neutral-900/20 rounded-3xl flex flex-col items-center gap-4">
              <div className="p-4 bg-white/5 rounded-full">
                <FolderGit2 className="w-8 h-8 text-neutral-500" />
              </div>
              <p className="text-neutral-400 font-medium">
                {activeTab === "personal" 
                  ? "No GitHub repositories found for your account." 
                  : "No public repositories imported yet."}
              </p>
            </div>
          ) : (
            /* Lively Repository Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentRepos.map((repo, idx) => (
                <div key={repo.id || idx} className="bg-neutral-900/40 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 hover:bg-neutral-800/50 transition-all duration-300 flex flex-col h-full group hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1">
                  
                  <div className="flex justify-between items-start mb-5">
                    <div className="min-w-0 pr-4">
                      <h3 className="text-lg font-semibold text-neutral-200 group-hover:text-indigo-400 transition-colors truncate" title={repo.name}>
                        {repo.name}
                      </h3>
                      <p className="text-sm text-neutral-500 mt-1.5 truncate flex items-center gap-1.5" title={repo.full_name}>
                        {repo.full_name}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 border ${
                      repo.private 
                        ? "bg-white/5 text-neutral-400 border-white/10" 
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}>
                      {repo.private ? "Private" : "Public"}
                    </span>
                  </div>
                  
                  <div className="mt-auto pt-6 flex gap-3">
                    {activeTab === "personal" && (
                      <button 
                        onClick={() => handlePrivateImport(repo)}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium py-2.5 px-4 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <FolderGit2 className="w-4 h-4" />
                        Import
                      </button>
                    )}
                    
                    <button 
                      onClick={() => setSelectedRepo(repo.full_name)}
                      className="flex-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-medium py-2.5 px-4 rounded-xl transition-all duration-300 text-sm flex items-center justify-center gap-2 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                    >
                      <Search className="w-4 h-4" />
                      Explore
                    </button>

                    {activeTab === "public" && (
                      <button 
                        onClick={() => handleDeletePublicRepo(repo.id)}
                        disabled={deletingId === repo.id}
                        className="flex-none bg-red-500/5 hover:bg-red-500/20 text-red-400 border border-transparent hover:border-red-500/30 font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                        title="Delete Repository"
                      >
                        {deletingId === repo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}