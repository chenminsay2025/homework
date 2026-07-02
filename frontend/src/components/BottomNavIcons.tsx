type IconProps = {
  className?: string;
  active?: boolean;
};

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function accentOpacity(active?: boolean) {
  return active ? 1 : 0.5;
}

/** 总览：四宫格仪表盘 */
export function NavDashboardIcon({ className = "h-6 w-6", active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect
        x="4.5"
        y="4.5"
        width="5"
        height="5"
        rx="1"
        fill="#6366f1"
        stroke="none"
        opacity={accentOpacity(active)}
      />
      <rect x="3" y="3" width="8" height="8" rx="1.5" {...stroke} />
      <rect x="13" y="3" width="8" height="5" rx="1.5" {...stroke} />
      <rect x="13" y="10" width="8" height="11" rx="1.5" {...stroke} />
      <rect x="3" y="13" width="8" height="8" rx="1.5" {...stroke} />
    </svg>
  );
}

/** 每日：日历单日 */
export function NavDailyIcon({ className = "h-6 w-6", active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect
        x="9"
        y="15"
        width="6"
        height="2.5"
        rx="0.75"
        fill="#f43f5e"
        stroke="none"
        opacity={accentOpacity(active)}
      />
      <rect x="3" y="4" width="18" height="18" rx="2" {...stroke} />
      <path d="M16 2v4M8 2v4M3 10h18" {...stroke} />
      <rect x="8" y="14" width="8" height="4" rx="1" {...stroke} />
    </svg>
  );
}

/** 课表：周历网格 */
export function NavScheduleIcon({ className = "h-6 w-6", active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle
        cx="9.5"
        cy="15.5"
        r="1.5"
        fill="#10b981"
        stroke="none"
        opacity={accentOpacity(active)}
      />
      <circle
        cx="16.5"
        cy="19.5"
        r="1.5"
        fill="#14b8a6"
        stroke="none"
        opacity={accentOpacity(active)}
      />
      <rect x="3" y="4" width="18" height="18" rx="2" {...stroke} />
      <path d="M3 9h18M8 4v4M16 4v4" {...stroke} />
      <path d="M8 13h3M13 13h3M8 17h3M13 17h3" {...stroke} />
    </svg>
  );
}

/** 任务：打开的书本 */
export function NavTasksIcon({ className = "h-6 w-6", active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M4 10.5c2-.6 4-.6 6.5 0 1.2.3 2.4.3 3.5 0"
        fill="#f59e0b"
        stroke="none"
        opacity={accentOpacity(active)}
      />
      <path d="M12 7v14" {...stroke} />
      <path
        d="M12 7c-1.5-1.2-3.5-1.5-5.5-1.2C4.5 6.1 3 7.5 3 9.5V20c2-.8 4.2-.8 6.5 0 1.5.5 3 .5 4.5 0 2.3-.8 4.5-.8 6.5 0V9.5c0-2-1.5-3.4-3.5-3.7C15.5 5.5 13.5 5.8 12 7z"
        {...stroke}
      />
    </svg>
  );
}

/** 我的：用户 */
export function NavMineIcon({ className = "h-6 w-6", active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle
        cx="12"
        cy="8"
        r="2.5"
        fill="#8b5cf6"
        stroke="none"
        opacity={accentOpacity(active)}
      />
      <circle cx="12" cy="8" r="4" {...stroke} />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" {...stroke} />
    </svg>
  );
}
