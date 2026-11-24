// أيقونات خطية بسيطة (24×24، stroke) — من غير مكتبات
type P = React.SVGProps<SVGSVGElement>;
const base = (p: P) => ({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p });

export const Icon = {
  grid: (p: P) => <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  users: (p: P) => <svg {...base(p)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  settings: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  list: (p: P) => <svg {...base(p)}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1" fill="currentColor"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/><circle cx="3.5" cy="18" r="1" fill="currentColor"/></svg>,
  user: (p: P) => <svg {...base(p)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  logout: (p: P) => <svg {...base(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  menu: (p: P) => <svg {...base(p)}><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  back: (p: P) => <svg {...base(p)}><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  open: (p: P) => <svg {...base(p)}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>,
  bell: (p: P) => <svg {...base(p)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  calendar: (p: P) => <svg {...base(p)}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  x: (p: P) => <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  search: (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>,
  shield: (p: P) => <svg {...base(p)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  key: (p: P) => <svg {...base(p)}><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></svg>,
  check: (p: P) => <svg {...base(p)}><path d="M20 6 9 17l-5-5"/></svg>,
  alert: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
  plus: (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14"/></svg>,
  clock: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  devices: (p: P) => <svg {...base(p)}><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  home: (p: P) => <svg {...base(p)}><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>,
  inbox: (p: P) => <svg {...base(p)}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  file: (p: P) => <svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>,
  wallet: (p: P) => <svg {...base(p)}><path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V5"/><path d="M16 13h.01"/></svg>,
  phone: (p: P) => <svg {...base(p)}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>,
  undo: (p: P) => <svg {...base(p)}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>,
  refresh: (p: P) => <svg {...base(p)}><path d="M21 2v6h-6M3 22v-6h6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>,
  tasks: (p: P) => <svg {...base(p)}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  activity: (p: P) => <svg {...base(p)}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  chart: (p: P) => <svg {...base(p)}><path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-9"/></svg>,
  upload: (p: P) => <svg {...base(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  download: (p: P) => <svg {...base(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  // أيقونات الأنظمة
  pill: (p: P) => <svg {...base(p)}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7"/></svg>,
  folder: (p: P) => <svg {...base(p)}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  ambulance: (p: P) => <svg {...base(p)}><path d="M10 17h4V5H2v12h3M14 9h4l3 3v5h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M8 9v4M6 11h4"/></svg>,
  stethoscope: (p: P) => <svg {...base(p)}><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>,
  handshake: (p: P) => <svg {...base(p)}><path d="m11 17 2 2a1 1 0 1 0 3-3M14 14l2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4M21 3l1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8"/></svg>,
  ticket: (p: P) => <svg {...base(p)}><path d="M2 9a3 3 0 0 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>,
  compass: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/></svg>,
  globe: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>,
  link: (p: P) => <svg {...base(p)}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>,
};

export const SYSTEM_ICONS: Record<string, (p: P) => React.JSX.Element> = {
  dispensing: Icon.pill, cases: Icon.folder, ambulance: Icon.ambulance, clinics: Icon.stethoscope,
  volunteers: Icon.handshake, tickets: Icon.ticket, tawjeeh: Icon.compass,
};
export const SystemIcon = ({ k, ...p }: P & { k: string }) => (SYSTEM_ICONS[k] ?? Icon.link)(p);

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="mT" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#14b8a6"/><stop offset="1" stopColor="#0f766e"/></linearGradient>
        <linearGradient id="mG" x1="24" y1="10" x2="24" y2="38" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#f5c33b"/><stop offset="1" stopColor="#e0a020"/></linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#mT)"/>
      <path fill="url(#mG)" d="M 15 20 Q 15 15, 20 15 L 28 15 Q 33 15, 33 20 L 33 24 Q 33 26, 31 26 L 22 26 Q 20 26, 20 28 L 20 33 Q 20 34, 19 34 L 16 34 Q 15 34, 15 33 Z"/>
      <circle cx="17.5" cy="30" r="1.5" fill="url(#mG)"/>
    </svg>
  );
}

/** لوجو مرسال الحقيقي — نسخة بيضاء على الخلفيات الغامقة */
export function Logo({ height = 44, onDark = false, className }: { height?: number; onDark?: boolean; className?: string }) {
  const w = Math.round(height * 440 / 278);
  if (onDark) return <img src="/logo-white.png" width={w} height={height} alt="مرسال" className={className} decoding="async" />;
  return (
    <picture className={className}>
      <img src="/logo.png" width={w} height={height} alt="مرسال" decoding="async" />
    </picture>
  );
}
