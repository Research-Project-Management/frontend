import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import Flux from "~/assets/Flux.svg?react";
import GoogleIcon from "~/assets/google.svg?react";
import GithubIcon from "~/assets/github.svg?react";
import Loading from "../ui/Loading";
import { useAuth } from "~/hooks";
import { API_URL, ApiError } from "~/lib/api";
import { registerUser } from "~/query/user";

type RegisterFormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const RegisterForm = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return <Loading />;
  }

  if (user) {
    return <Navigate to="/ws" replace={true} />;
  }

  const handleGoogleLogin = () => {
    window.location.href = API_URL + "/auth/google";
  };

  const handleGithubLogin = () => {
    window.location.href = API_URL + "/auth/github";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      return "Name is required";
    }

    if (!formData.email.trim()) {
      return "Email is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return "Email is invalid";
    }

    if (!formData.password) {
      return "Password is required";
    }

    if (formData.password.length < 6) {
      return "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      return "Confirm password is required";
    }

    if (formData.password !== formData.confirmPassword) {
      return "Password and confirm password do not match";
    }

    return "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      await registerUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      navigate("/login");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        return;
      }

      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-100 min-h-150 rounded-md">
      <div className="flex flex-col gap-6">
        <Link to={"/"}>
          <Flux className="w-18 h-18 mx-auto" />
        </Link>
        <h2 className="text-2xl font-semibold text-center">Register to Flux</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          name="name"
          type="text"
          placeholder="Name"
          value={formData.name}
          onChange={handleChange}
          className="w-full mt-6 p-3 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <input
          name="email"
          type="text"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          className="w-full mt-4 p-3 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          className="w-full mt-4 p-3 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          className="w-full mt-4 p-3 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {error && (
          <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-6 p-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Registering..." : "Register"}
        </button>

        <p className="mt-4 text-center text-gray-600">
          You have an account?{" "}
          <Link
            to="/login"
            className="text-primary font-semibold hover:underline"
          >
            Login
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

export default RegisterForm;