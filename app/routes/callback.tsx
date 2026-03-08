import { useEffect } from "react";
import { useNavigate } from "react-router";

export function meta() {
  return [{ title: "Signing in… · Flux" }];
}

export default function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect về workspace sau khi OAuth thành công
    const timer = setTimeout(() => {
      navigate("/ws", { replace: true });
    }, 100);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p>Đang đăng nhập...</p>
      </div>
    </div>
  );
}
