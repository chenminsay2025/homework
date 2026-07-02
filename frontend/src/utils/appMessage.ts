/** 在页面内提示操作错误（避免仅在控制台抛出未捕获异常） */
export function showAppError(error: unknown, fallback = "操作失败") {
  const message = error instanceof Error ? error.message : fallback;
  alert(message);
}
