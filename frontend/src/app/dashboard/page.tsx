"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchPanel from "../../components/SearchPanel";

// Define what a repository looks like
interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  const fetchRepositories = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8000/repos/github", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRepos(data);
      } else {
        console.error("Failed to fetch repos from backend.");
      }
    } catch (error) {
      console.error("Network request failed:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Repositories</h1>
          <button 
            onClick={() => {
              localStorage.removeItem("token");
              router.push("/");
            }}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md font-semibold transition"
          >
            Log Out
          </button>
        </div>
        
        {repos.length === 0 ? (
          <div className="border border-gray-800 rounded-lg p-12 text-center bg-gray-900/50">
            <h3 className="text-xl font-medium mb-2">Ready to explore?</h3>
            <p className="text-gray-400 mb-6">Connect to GitHub to view and index your repositories.</p>
            <button 
              onClick={fetchRepositories}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-md font-semibold transition disabled:opacity-50"
            >
              {loading ? "Fetching..." : "Load My GitHub Repositories"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repos.map(repo => (
              <div key={repo.id} className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:border-gray-600 transition flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold truncate" title={repo.full_name}>{repo.name}</h3>
                    {repo.private && <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300">Private</span>}
                  </div>
                  <p className="text-gray-400 text-sm mb-4 h-10 overflow-hidden">
                    {repo.description || "No description provided."}
                  </p>
                </div>
                <button 
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.innerText = "Importing...";
                    
                    try {
                      const token = localStorage.getItem("token");
                      const response = await fetch("http://localhost:8000/repos/import", {
                        method: "POST",
                        headers: {
                          "Authorization": `Bearer ${token}`,
                          "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                          github_repo_id: repo.id,
                          name: repo.name,
                          full_name: repo.full_name,
                          branch: "main"
                        })
                      });

                      if (response.ok) {
                        btn.innerText = "Imported!";
                        btn.classList.add("bg-green-600", "text-white");
                        btn.classList.remove("bg-white", "text-black");
                      } else {
                        btn.innerText = "Failed";
                        btn.disabled = false;
                      }
                    } catch (error) {
                      console.error(error);
                      btn.innerText = "Error";
                      btn.disabled = false;
                    }
                  }}
                  className="w-full bg-white text-black py-2 rounded font-medium hover:bg-gray-200 transition disabled:opacity-50 mt-4"
                >
                  Import for Indexing
                </button>
              </div>
            ))}
          </div>
        )}

{/* --- The Search Panel Component is now injected here! --- */}
        <div className="mt-12">
          <SearchPanel repositoryId={1} />
        </div>

      </div>
    </div>
  );
}