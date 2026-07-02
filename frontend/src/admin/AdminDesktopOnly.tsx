import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

const MIN_WIDTH = 1024;

export default function AdminDesktopOnly({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= MIN_WIDTH,
  );

  useEffect(() => {
    const check = () => setAllowed(window.innerWidth >= MIN_WIDTH);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900 px-8 text-center text-white">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold">运营后台</h1>
          <p className="mt-4 text-slate-300">运营后台仅支持 PC 端访问，请使用电脑浏览器打开。</p>
          <p className="mt-2 text-sm text-slate-500">建议窗口宽度 ≥ 1024px</p>
          <Link to="/" className="mt-8 inline-block text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            返回用户端
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
