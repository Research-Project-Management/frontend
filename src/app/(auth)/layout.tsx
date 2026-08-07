// Outlet removed - use children prop instead;


const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="container mx-auto min-h-screen flex flex-col">
      {/*<Navbar />*/}
      <div className="flex-1 flex flex-col justify-center items-center">
        {children}
      </div>
    </main>
  );
};

export default AuthLayout;
