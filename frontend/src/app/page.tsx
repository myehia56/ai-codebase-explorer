export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
      <h1 className="text-4xl font-bold mb-6">AI Codebase Explorer</h1>
      <p className="text-gray-400 mb-8 max-w-md text-center">
        Connect your GitHub repositories and ask questions about your code using AI.
      </p>
      {/* This button links directly to the FastAPI backend route we created */}
      <a 
        href="http://localhost:8000/auth/github" 
        className="bg-white text-black px-6 py-3 rounded-md font-semibold hover:bg-gray-200 transition"
      >
        Sign in with GitHub
      </a>
    </div>
  );
}