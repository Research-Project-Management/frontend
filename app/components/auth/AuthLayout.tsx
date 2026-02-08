import { Outlet } from "react-router";
import Navbar from "./Navbar";

const AuthLayout = () => {
  return (
    <main className="container mx-auto min-h-screen flex flex-col">
      {/*<Navbar />*/}
      <div className="flex-1 flex flex-col justify-center items-center">
        <Outlet />
      </div>
    </main>
  );
};

export default AuthLayout;
