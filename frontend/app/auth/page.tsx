"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signUpNewUser, signInWithEmail } from "../lib/auth";
import Spinner from "../components/Spinner";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState("signin");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const result =
        mode === "signup"
          ? await signUpNewUser(email, password)
          : await signInWithEmail(email, password);

      if (result.error) {
        setError(result.error.message);
      } else {
        router.push("/");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-sm mb-4 shadow-lg shadow-indigo-500/20">
            <svg
              className="w-8 h-8 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white drop-shadow-sm">
            Welcome back
          </h1>
          {mode === "signup" ? (
            <p className="text-sm text-white/70 mt-1">Sign up to get started</p>
          ) : (
            <p className="text-sm text-white/70 mt-1">
              Sign in to continue to ChatPDF
            </p>
          )}
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl shadow-black/5 p-6">
          <form onSubmit={handleAuth} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-zinc-500 mb-1.5 ml-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 bg-zinc-50 border border-zinc-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-zinc-500 mb-1.5 ml-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2.5 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 bg-zinc-50 border border-zinc-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!email.trim() || !password.trim() || isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/25 mt-2 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Spinner className="w-4 h-4" />}
              {isSubmitting
                ? mode === "signup"
                  ? "Signing up..."
                  : "Signing in..."
                : mode === "signup"
                  ? "Sign Up"
                  : "Sign In"}
            </button>
          </form>
        </div>

        {/* Footer link */}
        {mode === "signup" ? (
          <p className="text-xs text-white/50 text-center mt-5">
            Existing account?{" "}
            <span
              onClick={() => !isSubmitting && setMode("signin")}
              className={`text-white/80 hover:text-white cursor-pointer underline underline-offset-2 ${isSubmitting ? "pointer-events-none opacity-60" : ""}`}
            >
              Sign In
            </span>
          </p>
        ) : (
          <p className="text-xs text-white/50 text-center mt-5">
            Don&apos;t have an account?{" "}
            <span
              onClick={() => !isSubmitting && setMode("signup")}
              className={`text-white/80 hover:text-white cursor-pointer underline underline-offset-2 ${isSubmitting ? "pointer-events-none opacity-60" : ""}`}
            >
              Sign up
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
