// MZAZI TECH — icon set.
// Inline SVG on purpose: no icon-font request, no 3rd-party dependency, and
// every glyph inherits `currentColor` so it themes for free.
//
// Decorative by default (aria-hidden). Pass `label` when the icon is the only
// content of a control, so screen readers announce something meaningful.

const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  display: 'block',
  flexShrink: 0,
});

function Svg({ size = 18, label, children, filled = false }) {
  return (
    <svg {...base(size)} fill={filled ? 'currentColor' : 'none'} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined}>
      {label ? <title>{label}</title> : null}
      {children}
    </svg>
  );
}

/* ── Navigation & layout ──────────────────────────────────────────────────── */
export const Menu = (p) => <Svg {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Svg>;
export const X = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const ChevronDown = (p) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const ChevronRight = (p) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const ChevronLeft = (p) => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>;
export const ArrowRight = (p) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const ArrowLeft = (p) => <Svg {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Svg>;
export const MoreVertical = (p) => <Svg {...p}><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" /></Svg>;
export const ExternalLink = (p) => <Svg {...p}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Svg>;

/* ── Product surfaces ─────────────────────────────────────────────────────── */
export const Dashboard = (p) => <Svg {...p}><rect x="3" y="3" width="7.5" height="8.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="5.5" rx="2" /><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" /><rect x="3" y="14.5" width="7.5" height="6.5" rx="2" /></Svg>;
export const Phone = (p) => <Svg {...p}><rect x="6" y="2" width="12" height="20" rx="2.6" /><path d="M11 18.5h2" /></Svg>;
export const Bot = (p) => <Svg {...p}><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M8.5 14h.01M15.5 14h.01M9 20v1.5M15 20v1.5" /></Svg>;
export const CreditCard = (p) => <Svg {...p}><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></Svg>;
export const Wallet = (p) => <Svg {...p}><path d="M20 8V6.5A2.5 2.5 0 0 0 17.5 4H5.5A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h12A2.5 2.5 0 0 0 20 17.5V16" /><path d="M21 12h-5a2 2 0 0 0 0 4h5v-4Z" /></Svg>;
export const Users = (p) => <Svg {...p}><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3.4" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16.5 3.9a4 4 0 0 1 0 6.2" /></Svg>;
export const Command = (p) => <Svg {...p}><path d="M15 6a3 3 0 1 1 3 3h-3V6ZM9 6a3 3 0 1 0-3 3h3V6Zm6 12a3 3 0 1 1 3-3v3h-3Zm-6 0a3 3 0 1 0-3-3v3h3Zm0-9h6v6H9V9Z" /></Svg>;
export const Send = (p) => <Svg {...p}><path d="m21 3-9.5 9.5M21 3l-6.5 18-4-8.5L2 8.5 21 3Z" /></Svg>;
export const Ticket = (p) => <Svg {...p}><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6Z" /><path d="M13 5v14" strokeDasharray="2 3" /></Svg>;
export const Settings = (p) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 7.2 19.3l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3.6 13.6H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 7.2l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10.4 3.6V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 20.4 10.4H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.6Z" /></Svg>;
export const Help = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.25-.9.8-.9 1.45v.35M12 17h.01" /></Svg>;
export const Home = (p) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /></Svg>;
export const User = (p) => <Svg {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></Svg>;
export const Shield = (p) => <Svg {...p}><path d="M12 3 5 6v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6l-7-3Z" /><path d="m9.5 12 1.8 1.8 3.4-3.6" /></Svg>;
export const Search = (p) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Svg>;
export const Filter = (p) => <Svg {...p}><path d="M3 5h18M6.5 12h11M10 19h4" /></Svg>;
export const Plus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const Trash = (p) => <Svg {...p}><path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" /></Svg>;
export const Refresh = (p) => <Svg {...p}><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" /><path d="M20.5 4v4.5H16" /></Svg>;
export const LogOut = (p) => <Svg {...p}><path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H15" /><path d="M10 8l-4 4 4 4M6 12h9" /></Svg>;
export const Check = (p) => <Svg {...p}><path d="m4.5 12.5 5 5 10-11" /></Svg>;
export const CheckCircle = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16 9.5" /></Svg>;
export const AlertCircle = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></Svg>;
export const AlertTriangle = (p) => <Svg {...p}><path d="M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4M12 17h.01" /></Svg>;
export const Info = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const Clock = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></Svg>;
export const Calendar = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const Sun = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></Svg>;
export const Moon = (p) => <Svg {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></Svg>;
export const Monitor = (p) => <Svg {...p}><rect x="2.5" y="4" width="19" height="12.5" rx="2.5" /><path d="M8.5 20.5h7M12 16.5v4" /></Svg>;
export const Wifi = (p) => <Svg {...p}><path d="M4 9.5a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 16.4a4 4 0 0 1 4 0M12 19.5h.01" /></Svg>;
export const WifiOff = (p) => <Svg {...p}><path d="M3 3l18 18M9.5 12.6a4.5 4.5 0 0 0 1.5.4M12 19.5h.01M6.5 11.4A8 8 0 0 1 9 10M4 7.8A12 12 0 0 1 7.5 6M20 7.8a12 12 0 0 0-4-1.9" /></Svg>;
export const Zap = (p) => <Svg {...p}><path d="M13.5 2 4.5 13.5H11l-.5 8.5 9-11.5H13l.5-8.5Z" /></Svg>;
export const Sparkles = (p) => <Svg {...p}><path d="M12 3.5 13.6 8l4.4 1.6L13.6 11 12 15.5 10.4 11 6 9.6 10.4 8 12 3.5ZM18.5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" /></Svg>;
export const Image = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="m4 17 4.5-4.5 4 4L15.5 13 20 17.5" /></Svg>;
export const Eye = (p) => <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const Download = (p) => <Svg {...p}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16" /></Svg>;
export const Upload = (p) => <Svg {...p}><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 20h16" /></Svg>;
export const Link = (p) => <Svg {...p}><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.8 6.5" /><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3" /></Svg>;
export const Pause = (p) => <Svg {...p}><path d="M9 4.5v15M15 4.5v15" /></Svg>;
export const Play = (p) => <Svg {...p}><path d="M7 4.5v15l12-7.5-12-7.5Z" /></Svg>;
export const Pencil = (p) => <Svg {...p}><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m14.5 5.5 4 4" /></Svg>;
export const Copy = (p) => <Svg {...p}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></Svg>;
export const Ban = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></Svg>;

// Brand glyph — WhatsApp pairing is the core product action, so it gets a mark.
export const WhatsApp = ({ size = 18, label, ...rest }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
    aria-hidden={label ? undefined : true} role={label ? 'img' : undefined}
    style={{ display: 'block', flexShrink: 0 }} {...rest}
  >
    {label ? <title>{label}</title> : null}
    <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.45 3.44 1.32 4.94L2 22l5.35-1.4a9.86 9.86 0 0 0 4.69 1.19h.01c5.43 0 9.84-4.4 9.84-9.84 0-2.63-1.02-5.1-2.88-6.96A9.78 9.78 0 0 0 12.04 2Zm0 1.8c2.15 0 4.17.84 5.69 2.36a8 8 0 0 1 2.36 5.69c0 4.44-3.61 8.04-8.05 8.04a8.06 8.06 0 0 1-4.1-1.12l-.3-.18-3.05.8.81-2.97-.19-.31a7.98 7.98 0 0 1-1.22-4.26c0-4.44 3.6-8.05 8.05-8.05Zm-3.6 4.02c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.42 1.03 2.58.12.17 1.75 2.79 4.24 3.8.59.26 1.05.41 1.41.52.6.19 1.14.16 1.56.1.48-.07 1.45-.6 1.66-1.17.2-.58.2-1.07.14-1.17-.06-.1-.23-.17-.48-.29-.25-.13-1.45-.72-1.68-.8-.23-.08-.39-.13-.55.12-.16.25-.63.8-.77.96-.14.17-.28.19-.52.07-.25-.13-1.04-.39-1.98-1.23-.73-.65-1.22-1.45-1.36-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.03-.44-.06-.12-.55-1.33-.76-1.82-.18-.42-.37-.43-.5-.43h-.02Z" />
  </svg>
);

export const Icon = Svg;
