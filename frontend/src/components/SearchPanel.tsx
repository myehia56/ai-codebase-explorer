"use client";

import { useState } from "react";
import { Search, Terminal, Sparkles, Copy, Check, ChevronDown, ChevronUp, Code2 } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const INVALID_QUERY_TRIGGER = "The input provided is not recognized";

function CodeChunkCard({ result, index }: { result: any; index: number }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const ext = result.file_path.split('.').pop() || 'typescript';

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700/50 overflow-hidden shadow-sm transition-all hover:border-slate-600/50 shrink-0">
      <div 
        className="bg-slate-950/80 px-4 py-3 border-b border-slate-800/50 flex justify-between items-center cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 overflow-hidden pr-4">
          <Code2 className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm font-mono text-slate-300 truncate" title={result.file_path}>
            {result.file_path}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-slate-500 bg-slate-800/50 px-2 py-1 rounded-md">
            Match #{index + 1}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="text-slate-400 hover:text-white transition-colors"
            title="Copy code"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className="overflow-x-auto text-sm max-h-[400px] custom-scrollbar">
          <SyntaxHighlighter
            language={ext}
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
            showLineNumbers
          >
            {result.content}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}

export default function SearchPanel({ repositoryName }: { repositoryName: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [aiExplanation, setAiExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isInvalidQuery = aiExplanation.includes(INVALID_QUERY_TRIGGER);
  const cleanRepoName = repositoryName.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/i, "");

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
        repository_name: cleanRepoName,
        query: query,
        limit: 5,
      });

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

      searchPromise
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setResults(data.results || []);
          }
        })
        .catch((err) => console.error("Error fetching chunks:", err));

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
    <div className="mt-8 bg-slate-950 p-6 sm:p-8 rounded-xl shadow-2xl border border-slate-800">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-blue-500" />
          Codebase Explorer
        </h2>
        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded-full border border-blue-500/20">
          {cleanRepoName}
        </span>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., How is the database connection handled?"
            className="w-full pl-12 pr-4 py-4 rounded-lg bg-slate-900 text-slate-100 border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg disabled:opacity-50 disabled:hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Searching
            </span>
          ) : (
            "Analyze"
          )}
        </button>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: AI Analysis */}
        {(aiExplanation || isLoading) && (
          <div className="h-fit">
            <div
              className={`p-6 rounded-xl leading-relaxed border transition-all duration-300 ${
                isInvalidQuery
                  ? "bg-amber-950/20 border-amber-900/50 text-amber-200"
                  : "bg-slate-900 border-slate-700/50 text-slate-300 shadow-[0_0_30px_-10px_rgba(59,130,246,0.15)] relative overflow-hidden"
              }`}
            >
              {!isInvalidQuery && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-400 opacity-50"></div>
              )}
              
              <h3
                className={`font-semibold mb-4 flex items-center gap-2 ${
                  isInvalidQuery ? "text-amber-400" : "text-slate-100"
                }`}
              >
                <Sparkles className={`w-5 h-5 ${isInvalidQuery ? "text-amber-400" : "text-blue-400"}`} />
                AI Analysis
                {isLoading && !aiExplanation && (
                  <span className="flex gap-1 ml-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                )}
              </h3>
              <p className="whitespace-pre-wrap text-[15px]">{aiExplanation}</p>
            </div>
          </div>
        )}

        {/* Right Column: Code Chunks & Skeletons STRICTLY ISOLATED */}
        <div className="space-y-4">
          {(results.length > 0 || isLoading) && (
             <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
               Context References
               {aiExplanation && results.length > 0 && (
                 <span className="bg-slate-800 text-slate-300 py-0.5 px-2 rounded-full">{results.length}</span>
               )}
             </h4>
          )}

          {isLoading && !aiExplanation ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-slate-900 rounded-lg border border-slate-800 p-4 animate-pulse">
                  <div className="flex justify-between items-center mb-4">
                    <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                    <div className="h-4 bg-slate-800 rounded w-16"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-800 rounded w-full"></div>
                    <div className="h-3 bg-slate-800 rounded w-5/6"></div>
                    <div className="h-3 bg-slate-800 rounded w-4/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !isInvalidQuery && aiExplanation && results.length > 0 ? (
              <div className="flex flex-col gap-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar pb-4 animate-in fade-in duration-300">
                {results.map((result, index) => (
                  <CodeChunkCard key={index} result={result} index={index} />
                ))}
              </div>
            ) : null
          )}
        </div>
      </div>

      {!isInvalidQuery && results.length === 0 && !isLoading && !error && !aiExplanation && (
        <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center gap-3">
          <Search className="w-8 h-8 text-slate-600" />
          <p className="text-slate-400 font-medium">Ready to explore.</p>
          <p className="text-slate-500 text-sm">Ask a specific question to search the repository's architecture and logic.</p>
        </div>
      )}
    </div>
  );
}