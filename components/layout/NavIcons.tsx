const PATHS = {
  arrow: "M4 12h15m-6-6 6 6-6 6",
  diamond: "m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18",
  search: "M16 16l5 5M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z",
  user: "M4 21v-2a8 8 0 0 1 16 0v2M12 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  close: "m5 5 14 14M19 5 5 19",
} as const;

export function NavIcon({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg
      className="nav-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
