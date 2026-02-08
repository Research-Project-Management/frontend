import React, { useState } from "react";
import { Link } from "react-router";
import Flux from "~/assets/Flux.svg?react";

const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        import.meta.env.VITE_API_URL + "/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to send reset email");
      }

      setIsSubmitted(true);
    } catch (err) {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto w-[400px] min-h-[400px] rounded-md">
        <div className="flex flex-col gap-6">
          <Link to={"/"}>
            <Flux className="w-18 h-18 mx-auto" />
          </Link>
          <h2 className="text-2xl font-semibold text-center">
            Check your email
          </h2>
        </div>
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            We've sent a password reset link to{" "}
            <span className="font-semibold">{email}</span>
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Didn't receive the email? Check your spam folder or{" "}
            <button
              onClick={() => setIsSubmitted(false)}
              className="text-black font-semibold hover:underline"
            >
              try again
            </button>
          </p>
        </div>
        <Link
          to="/login"
          className="block w-full mt-8 p-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors text-center"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[400px] min-h-[400px] rounded-md">
      <div className="flex flex-col gap-6">
        <Link to={"/"}>
          <Flux className="w-18 h-18 mx-auto" />
        </Link>
        <h2 className="text-2xl font-semibold text-center">Forgot Password</h2>
        <p className="text-center text-gray-600 text-sm">
          Enter your email address and we'll send you a link to reset your
          password.
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full mt-6 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
        />
        {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-6 p-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Sending..." : "Send Reset Link"}
        </button>
        <p className="mt-4 text-center text-gray-600">
          Remember your password?{" "}
          <Link
            to="/login"
            className="text-black font-semibold hover:underline"
          >
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default ForgotPasswordForm;
