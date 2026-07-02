/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        /* 手机端最小可读字号 14px（原 xs 为 12px 过小） */
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
