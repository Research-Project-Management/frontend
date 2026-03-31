import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import Flux from "~/assets/Flux.svg?react";
import GoogleIcon from "~/assets/google.svg?react";
import GithubIcon from "~/assets/github.svg?react";
import Loading from "../ui/Loading";
import { useAuth } from "~/hooks/useAuth";
import { API_URL, ApiError, apiPost } from "~/lib/api";

const LoginForm = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleLogin = () => {
    window.location.href = API_URL + "/auth/google";
  };
  const handleGithubLogin = () => {
    window.location.href = API_URL + "/auth/github";
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "email") setEmail(value);
    if (name === "password") setPassword(value);
    if (error) setError("");
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await apiPost("/auth/login", { email: email.trim(), password });
      navigate("/ws");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <Loading />;
  if (user) return <Navigate to="/ws" replace={true} />;

  return (
    <div className="mx-auto w-100 min-h-150 rounded-md">
      <div className="flex flex-col gap-6">
        <Link to="/">
          <Flux className="w-18 h-18 mx-auto" />
        </Link>
        <h2 className="text-2xl font-semibold text-center">Login to Flux</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <input
          name="email"
          type="text"
          placeholder="Email"
          value={email}
          onChange={handleChange}
          className="w-full mt-6 p-3 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={handleChange}
          className="w-full mt-4 p-3 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-2 text-right">
          <Link
            to="/forgot-password"
            className="text-sm text-gray-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        {error && (
          <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-6 p-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
        <p className="mt-4 text-center text-gray-600">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-primary font-semibold hover:underline"
          >
            Register
          </Link>
        </p>
      </form>
      <div>
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex items-center my-6 w-full gap-2 justify-center border p-2 py-3 border-secondary rounded-lg"
        >
          <GoogleIcon className="w-6 h-6 inline-block" />
          <span className="ml-2 text-gray-700">Login with Google</span>
        </button>
      </div>
      <div>
        <button
          type="button"
          onClick={handleGithubLogin}
          className="flex items-center my-6 w-full gap-2 justify-center border p-2 py-3 border-secondary rounded-lg"
        >
          <GithubIcon className="w-6 h-6 inline-block" />
          <span className="ml-2 text-gray-700">Login with Github</span>
        </button>
      </div>
    </div>
  );
};

export default LoginForm;