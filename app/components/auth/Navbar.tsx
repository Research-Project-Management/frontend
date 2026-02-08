import { Link } from "react-router";
import Flux from "~/assets/Flux.svg?react";
export default function Navbar() {
  return (
    <nav className="flex justify-between items-center p-4">
      <Link to={"/"} className="flex gap-2 items-center">
        <Flux className="w-8 h-8" />
        <div className="font-bold text-xl">Flux</div>
      </Link>
      <div className="flex items-center gap-6">
        <Link
          to="signup"
          className="font-medium hover:underline underline-offset-2"
        >
          Sign Up
        </Link>
        <Link
          to="login"
          className="font-medium hover:underline underline-offset-2"
        >
          Login
        </Link>
        <Link
          to="/workspace/dashboard"
          className="py-2 px-4 bg-black text-white rounded-md font-medium "
        >
          Workspace
        </Link>
      </div>
    </nav>
  );
}
