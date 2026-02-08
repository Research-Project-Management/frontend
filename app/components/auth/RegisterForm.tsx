import React, { useState } from "react";
import { Link, Navigate } from "react-router";
import { useNavigate } from "react-router";
import Flux from "~/assets/Flux.svg?react";
import GoogleIcon from "~/assets/google.svg?react";
import GithubIcon from "~/assets/github.svg?react";
import Loading from "../ui/Loading";
import { useAuth } from "~/hooks";
const RegisterForm = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Loading />;
  }
  if (user) {
    return <Navigate to="/ws" replace={true} />;
  }

  const handleGoogleLogin = () => {
    window.location.href = import.meta.env.VITE_API_URL + "/auth/google";
  };

  const handleGithubLogin = () => {
    window.location.href = import.meta.env.VITE_API_URL + "/auth/github";
  };

  return (
    <div className=" mx-auto w-[400px] min-h-[600px] rounded-md ">
      <div className="flex flex-col gap-6">
        <Link to={"/"}>
          <Flux className="w-18 h-18 mx-auto" />
        </Link>
        <h2 className="text-2xl font-semibold text-center ">
          Register to Flux
        </h2>
      </div>
      <form>
        <input
          type="text"
          placeholder="Email"
          className="w-full mt-6 p-3 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full mt-4 p-3 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="w-full mt-6 p-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Register
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
          onClick={handleGoogleLogin}
          className="flex items-center my-6 w-full gap-2 justify-center border p-2 py-3 border-secondary rounded-lg"
        >
          <GoogleIcon className="w-6 h-6 inline-block" />
          <span className="ml-2 text-gray-700">Login with Google</span>
        </button>
      </div>
      <div>
        <button
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
