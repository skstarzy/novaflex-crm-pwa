// Small, dependency-free icon set. Each is a simple functional component
// taking { size, className } — same calling convention as lucide-react,
// so porting the rest of the app didn't require touching every icon call site.

function Icon({ size = 16, className = "", children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

const LayoutDashboard = (p) => (
  <Icon {...p}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></Icon>
);
const Package = (p) => (
  <Icon {...p}><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></Icon>
);
const ShoppingCart = (p) => (
  <Icon {...p}><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h2l2.6 12.6a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/></Icon>
);
const Users = (p) => (
  <Icon {...p}><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 13.5a5.2 5.2 0 0 1 6 6.5"/></Icon>
);
const Plus = (p) => (
  <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>
);
const Minus = (p) => (
  <Icon {...p}><path d="M5 12h14"/></Icon>
);
const AlertTriangle = (p) => (
  <Icon {...p}><path d="M12 3 1 21h22L12 3z"/><path d="M12 9v5"/><path d="M12 17.5v.1"/></Icon>
);
const TrendingUp = (p) => (
  <Icon {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M15 6h6v6"/></Icon>
);
const DollarSign = (p) => (
  <Icon {...p}><path d="M12 2v20"/><path d="M17 6.5a4 4 0 0 0-4-2.5H10a3.5 3.5 0 0 0 0 7h4a3.5 3.5 0 0 1 0 7h-3a4 4 0 0 1-4-2.5"/></Icon>
);
const Search = (p) => (
  <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Icon>
);
const X = (p) => (
  <Icon {...p}><path d="M18 6 6 18M6 6l12 12"/></Icon>
);
const ChevronRight = (p) => (
  <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>
);
const Trash2 = (p) => (
  <Icon {...p}><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/><path d="M10 11v6M14 11v6"/></Icon>
);
const Edit2 = (p) => (
  <Icon {...p}><path d="M17 3a2.8 2.8 0 1 1 4 4L7 21l-4 1 1-4L17 3z"/></Icon>
);
const Check = (p) => (
  <Icon {...p}><path d="M20 6 9 17l-5-5"/></Icon>
);
const Download = (p) => (
  <Icon {...p}><path d="M12 3v13"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></Icon>
);
const PackagePlus = (p) => (
  <Icon {...p}><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/><path d="M16 5.5v5M13.5 8h5"/></Icon>
);
const LogOut = (p) => (
  <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></Icon>
);
