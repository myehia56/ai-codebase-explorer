"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function TokenHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      // Save the token securely in the browser's local storage
      localStorage.setItem("token", token);
      // Redirect the user to their new dashboard
      router.push("/dashboard");
    } else {
      // If something went wrong, send them back to the home page
      router.push("/");
    }
  }, [searchParams, router]);

  return <div className="p-8 text-center text-white">Authenticating...</div>;
}

export default function LoginSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <TokenHandler />
      </Suspense>
    </div>
  );
}