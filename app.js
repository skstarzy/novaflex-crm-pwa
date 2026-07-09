const { useState, useEffect, useCallback } = React;

const API = window.NOVAFLEX_API_URL;
const money = (n) => `$${Number(n).toFixed(2)}`;

const CATEGORIES = ["All", "Weight Loss", "Growth & Recovery", "Healing", "Skin & Aesthetics", "Cognitive & Longevity", "Stacks & Blends", "Supplies"];

// ---------------------------------------------------------------
// API helper: sends cookies automatically, and transparently retries
// once via the refresh endpoint if the access token has expired —
// the frontend never has to think about token lifetimes itself.
// ---------------------------------------------------------------
async function apiFetch(path, options = {}) {
  const doFetch = () =>
    fetch(`${API}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch();

  if (res.status === 401) {
    let code;
    try { code = (await res.clone().json()).code; } catch {}
    if (code === "TOKEN_EXPIRED") {
      const refreshed = await fetch(`${API}/api/auth/refresh`, { method: "POST", credentials: "include" });
      if (refreshed.ok) {
        res = await doFetch();
      }
    }
  }

  if (!res.ok) {
    let error = `Request failed (${res.status})`;
    try { error = (await res.json()).error || error; } catch {}
    const err = new Error(error);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------
// Root app: gate everything behind a session check
// ---------------------------------------------------------------
function App() {
  const [authState, setAuthState] = useState("checking"); // checking | out | in
  const [user, setUser] = useState(null);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((u) => { setUser(u); setAuthState("in"); })
      .catch(() => setAuthState("out"));
  }, []);

  const handleLogin = (u) => { setUser(u); setAuthState("in"); };
  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setAuthState("out");
  };

  if (authState === "checking") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 font-mono text-sm">Checking session…</div>
      </div>
    );
  }
  if (authState === "out") {
    return <LoginScreen onLogin={handleLogin} />;
  }
  return <CRM user={user} onLogout={handleLogout} />;
}

// ---------------------------------------------------------------
// Login screen
// ---------------------------------------------------------------
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
      onLogin(res.user);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center font-bold text-zinc-900 text-sm">N</div>
          <span className="font-bold tracking-tight text-lg text-zinc-100">
            NOVA<span className="text-amber-400">FLEX</span>
            <span className="text-zinc-500 font-normal text-xs ml-2 align-middle">CRM</span>
          </span>
        </div>
        <label className="text-xs text-zinc-500 uppercase tracking-wide font-mono block mb-1">Email</label>
        <input
          type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:border-amber-500 text-zinc-100"
        />
        <label className="text-xs text-zinc-500 uppercase tracking-wide font-mono block mb-1">Password</label>
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:border-amber-500 text-zinc-100"
        />
        {error && <div className="text-red-400 text-xs mb-3">{error}</div>}
        <button
          type="submit" disabled={loading}
          className="w-full py-2 rounded bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------
// Main CRM (mirrors the original artifact's structure and views)
// ---------------------------------------------------------------
function CRM({ user, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const refreshAll = useCallback(async () => {
    const [p, c, o] = await Promise.all([
      apiFetch("/api/products"),
      apiFetch("/api/customers"),
      apiFetch("/api/orders"),
    ]);
    setProducts(p);
    setCustomers(c);
    setOrders(o);
  }, []);

  useEffect(() => {
    refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 font-mono text-sm">Loading NovaFlex CRM…</div>
      </div>
    );
  }

  const lowStock = products.filter((p) => p.stock <= p.reorderLevel);
  const totalInventoryValue = products.reduce((s, p) => s + p.stock * Number(p.cost), 0);
  const paidOrders = orders.filter((o) => o.status === "paid");
  const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
  const totalProfit = paidOrders.reduce((s, o) => s + Number(o.profit), 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <TopNav tab={tab} setTab={setTab} lowStockCount={lowStock.length} user={user} onLogout={onLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "dashboard" && (
          <Dashboard products={products} orders={paidOrders} customers={customers} lowStock={lowStock}
            totalInventoryValue={totalInventoryValue} totalRevenue={totalRevenue} totalProfit={totalProfit} setTab={setTab} />
        )}
        {tab === "inventory" && <Inventory products={products} refreshAll={refreshAll} showToast={showToast} />}
        {tab === "orders" && <Orders products={products} customers={customers} orders={orders} refreshAll={refreshAll} showToast={showToast} />}
        {tab === "customers" && <Customers customers={customers} orders={orders} refreshAll={refreshAll} showToast={showToast} />}
        {tab === "affiliates" && <Affiliates showToast={showToast} />}
      </main>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-900 font-semibold px-5 py-2.5 rounded shadow-lg z-50 flex items-center gap-2">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

function TopNav({ tab, setTab, lowStockCount, user, onLogout }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", icon: Package, badge: lowStockCount },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "customers", label: "Customers", icon: Users },
    { id: "affiliates", label: "Affiliates", icon: TrendingUp },
  ];
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-40 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center font-bold text-zinc-900 text-sm">N</div>
          <span className="font-bold tracking-tight text-lg">
            NOVA<span className="text-amber-400">FLEX</span>
            <span className="text-zinc-500 font-normal text-xs ml-2 align-middle">CRM</span>
          </span>
        </div>
        <nav className="flex gap-1 items-center">
          {items.map((it) => {
            const IconComp = it.icon;
            const active = tab === it.id;
            return (
              <button key={it.id} onClick={() => setTab(it.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors ${active ? "bg-amber-500 text-zinc-900" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"}`}>
                <IconComp size={15} />
                <span className="hidden sm:inline">{it.label}</span>
                {it.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{it.badge}</span>
                )}
              </button>
            );
          })}
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <span className="text-zinc-500 text-xs hidden md:inline">{user?.name}</span>
          <button onClick={onLogout} title="Log out" className="p-2 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-900">
            <LogOut size={15} />
          </button>
        </nav>
      </div>
    </header>
  );
}

function StatCard({ label, value, icon: IconComp, accent }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500 font-mono">{label}</span>
        <IconComp size={16} className={accent || "text-amber-400"} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Dashboard({ products, orders, customers, lowStock, totalInventoryValue, totalRevenue, totalProfit, setTab }) {
  const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const topSellers = [...products]
    .map((p) => ({ ...p, sold: orders.reduce((s, o) => s + (o.items.find((i) => i.productId === p.id)?.qty || 0), 0) }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Overview of stock, sales, and customers.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Inventory Value" value={money(totalInventoryValue)} icon={Package} />
        <StatCard label="Total Revenue" value={money(totalRevenue)} icon={DollarSign} accent="text-green-400" />
        <StatCard label="Total Profit" value={money(totalProfit)} icon={TrendingUp} accent="text-green-400" />
        <StatCard label="Customers" value={customers.length} icon={Users} />
      </div>
      {lowStock.length > 0 && (
        <div className="bg-red-950/40 border border-red-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="font-semibold text-red-300 text-sm">{lowStock.length} SKU{lowStock.length > 1 ? "s" : ""} at or below reorder level</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <span key={p.id} className="text-xs bg-red-900/50 text-red-200 px-2 py-1 rounded font-mono">{p.name} ({p.spec}) — {p.stock} left</span>
            ))}
          </div>
          <button onClick={() => setTab("inventory")} className="mt-3 text-xs text-red-300 hover:text-red-100 flex items-center gap-1">
            Go to Inventory <ChevronRight size={12} />
          </button>
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Recent Orders</h2>
          {recentOrders.length === 0 ? <p className="text-zinc-500 text-sm">No orders yet.</p> : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm border-b border-zinc-800 pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{o.customer?.name}</div>
                    <div className="text-zinc-500 text-xs">{new Date(o.createdAt).toLocaleDateString()} · {o.items.length} item{o.items.length > 1 ? "s" : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{money(o.total)}</div>
                    <div className="text-green-400 text-xs font-mono">+{money(o.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Top Sellers (by units)</h2>
          {topSellers.every((p) => p.sold === 0) ? <p className="text-zinc-500 text-sm">No sales recorded yet.</p> : (
            <div className="space-y-2">
              {topSellers.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name} <span className="text-zinc-500">({p.spec})</span></span>
                  <span className="font-mono text-amber-400">{p.sold} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Inventory({ products, refreshAll, showToast }) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [showReceive, setShowReceive] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = products.filter((p) => {
    const matchCat = category === "All" || p.category === category;
    const matchQuery = (p.name + " " + p.spec).toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  const adjustStock = async (p, delta) => {
    const next = Math.max(0, p.stock + delta);
    setBusy(true);
    try {
      await apiFetch(`/api/products/${p.id}`, { method: "PATCH", body: { stock: next } });
      await refreshAll();
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id, fields) => {
    try {
      await apiFetch(`/api/products/${id}`, { method: "PATCH", body: fields });
      await refreshAll();
      setEditing(null);
      showToast("Product updated");
    } catch (err) {
      showToast(err.message);
    }
  };

  const receiveShipment = async (qtys) => {
    try {
      await Promise.all(
        Object.entries(qtys).map(([id, qty]) => {
          const p = products.find((p) => p.id === id);
          return apiFetch(`/api/products/${id}`, { method: "PATCH", body: { stock: p.stock + qty } });
        })
      );
      await refreshAll();
      setShowReceive(false);
      const totalUnits = Object.values(qtys).reduce((s, q) => s + q, 0);
      showToast(`Shipment received — ${totalUnits} units added across ${Object.keys(qtys).length} SKUs`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const exportCSV = () => {
    const rows = [["Product", "Spec", "Category", "Cost", "Price", "Stock", "Reorder Level"]];
    products.forEach((p) => rows.push([p.name, p.spec, p.category, p.cost, p.price, p.stock, p.reorderLevel]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `novaflex-inventory-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Inventory exported");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Inventory</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{products.length} SKUs · adjust stock as it moves.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…"
              className="bg-zinc-900 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-sm w-56 focus:outline-none focus:border-amber-500" />
          </div>
          <button onClick={() => setShowReceive(true)}
            className="flex items-center gap-1.5 bg-amber-500 text-zinc-900 font-semibold text-sm px-3 py-1.5 rounded hover:bg-amber-400 whitespace-nowrap">
            <PackagePlus size={15} /> Receive Shipment
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 border border-zinc-700 text-zinc-300 text-sm px-3 py-1.5 rounded hover:border-amber-500 hover:text-amber-400 whitespace-nowrap">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${category === c ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-800/60 text-zinc-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Product</th>
              <th className="text-left px-4 py-2.5 font-medium">Category</th>
              <th className="text-right px-4 py-2.5 font-medium">Cost</th>
              <th className="text-right px-4 py-2.5 font-medium">Price</th>
              <th className="text-right px-4 py-2.5 font-medium">Margin</th>
              <th className="text-center px-4 py-2.5 font-medium">Stock</th>
              <th className="text-center px-4 py-2.5 font-medium">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const low = p.stock <= p.reorderLevel;
              const margin = ((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100;
              return (
                <tr key={p.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-zinc-500 text-xs font-mono">{p.spec}</div>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs">{p.category}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{money(p.cost)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{money(p.price)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{margin.toFixed(0)}%</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-mono font-semibold px-2 py-0.5 rounded ${low ? "bg-red-900/50 text-red-300" : "text-zinc-200"}`}>{p.stock}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button disabled={busy} onClick={() => adjustStock(p, -1)} className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 hover:border-amber-500 hover:text-amber-400 disabled:opacity-40"><Minus size={12} /></button>
                      <button disabled={busy} onClick={() => adjustStock(p, 1)} className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 hover:border-amber-500 hover:text-amber-400 disabled:opacity-40"><Plus size={12} /></button>
                      <button onClick={() => setEditing(p)} className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 hover:border-amber-500 hover:text-amber-400 ml-1"><Edit2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-10 text-zinc-500 text-sm">No products match your search.</div>}
      </div>

      {editing && <EditProductModal product={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {showReceive && <ReceiveShipmentModal products={products} onClose={() => setShowReceive(false)} onReceive={receiveShipment} />}
    </div>
  );
}

function EditProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({ cost: product.cost, price: product.price, stock: product.stock, reorderLevel: product.reorderLevel });
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{product.name} <span className="text-zinc-500 font-normal text-sm">({product.spec})</span></h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          {["cost", "price", "stock", "reorderLevel"].map((field) => (
            <div key={field}>
              <label className="text-xs text-zinc-500 uppercase tracking-wide font-mono block mb-1">{field === "reorderLevel" ? "Reorder Threshold" : field}</label>
              <input type="number" value={form[field]} onChange={(e) => setForm({ ...form, [field]: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded border border-zinc-700 text-sm hover:bg-zinc-800">Cancel</button>
          <button onClick={() => onSave(product.id, form)} className="flex-1 py-2 rounded bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400">Save</button>
        </div>
      </div>
    </div>
  );
}

function ReceiveShipmentModal({ products, onClose, onReceive }) {
  const [qtys, setQtys] = useState({});
  const setQty = (id, val) => setQtys({ ...qtys, [id]: Math.max(0, Number(val) || 0) });
  const totalUnits = Object.values(qtys).reduce((s, q) => s + q, 0);
  const totalCost = products.reduce((s, p) => s + (qtys[p.id] || 0) * Number(p.cost), 0);
  const submit = () => {
    const nonZero = Object.fromEntries(Object.entries(qtys).filter(([, q]) => q > 0));
    if (Object.keys(nonZero).length === 0) return;
    onReceive(nonZero);
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold flex items-center gap-2"><PackagePlus size={17} className="text-amber-400" /> Receive Shipment</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>
        <p className="text-zinc-500 text-xs mb-4">Enter quantity received per SKU — added on top of current stock.</p>
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-zinc-800/60">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-zinc-500 text-xs font-mono">{p.spec} · currently {p.stock} in stock</div>
              </div>
              <input type="number" min={0} value={qtys[p.id] || ""} onChange={(e) => setQty(p.id, e.target.value)} placeholder="0"
                className="w-20 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-amber-500" />
            </div>
          ))}
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded p-3 mt-4 flex justify-between text-sm">
          <div><div className="text-zinc-500 text-xs">Units Received</div><div className="font-mono font-semibold">{totalUnits}</div></div>
          <div className="text-right"><div className="text-zinc-500 text-xs">Received at Cost</div><div className="font-mono font-semibold">{money(totalCost)}</div></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded border border-zinc-700 text-sm hover:bg-zinc-800">Cancel</button>
          <button onClick={submit} disabled={totalUnits === 0} className="flex-1 py-2 rounded bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed">Add to Inventory</button>
        </div>
      </div>
    </div>
  );
}

function Orders({ products, customers, orders, refreshAll, showToast }) {
  const [showForm, setShowForm] = useState(false);

  const createOrder = async (payload) => {
    try {
      await apiFetch("/api/orders", { method: "POST", body: payload });
      await refreshAll();
      setShowForm(false);
      showToast("Order created — inventory updated");
    } catch (err) {
      showToast(err.message);
      throw err;
    }
  };

  const exportCSV = () => {
    const rows = [["Date", "Customer", "Items", "Total", "Profit", "Status"]];
    [...orders].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).forEach((o) =>
      rows.push([new Date(o.createdAt).toLocaleDateString(), o.customer?.name, o.items.map(i=>`${i.name} x${i.qty}`).join("; "), o.total, o.profit, o.status])
    );
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `novaflex-orders-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Orders exported");
  };

  const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Orders</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{orders.length} order{orders.length !== 1 ? "s" : ""} recorded.</p>
        </div>
        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <button onClick={exportCSV} className="flex items-center gap-1.5 border border-zinc-700 text-zinc-300 text-sm px-3 py-2 rounded hover:border-amber-500 hover:text-amber-400">
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-amber-500 text-zinc-900 font-semibold text-sm px-3 py-2 rounded hover:bg-amber-400">
            <Plus size={15} /> New Order
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">No orders yet. Click "New Order" to record your first sale.</div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800/60 text-zinc-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium">Items</th>
                <th className="text-center px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Total</th>
                <th className="text-right px-4 py-2.5 font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => (
                <tr key={o.id} className="border-t border-zinc-800">
                  <td className="px-4 py-2.5 text-zinc-400">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 font-medium">{o.customer?.name}</td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs">{o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${o.status === "paid" ? "bg-green-900/40 text-green-300" : o.status === "pending" ? "bg-amber-900/40 text-amber-300" : "bg-zinc-800 text-zinc-400"}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{money(o.total)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-green-400">{money(o.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <NewOrderModal products={products} customers={customers} onClose={() => setShowForm(false)} onCreate={createOrder} />}
    </div>
  );
}

function NewOrderModal({ products, customers, onClose, onCreate }) {
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [lines, setLines] = useState([{ productId: "", qty: 1 }]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addLine = () => setLines([...lines, { productId: "", qty: 1 }]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx, field, value) => { const next = [...lines]; next[idx] = { ...next[idx], [field]: value }; setLines(next); };

  const validLines = lines.filter((l) => l.productId && l.qty > 0);
  const total = validLines.reduce((s, l) => { const p = products.find((p) => p.id === l.productId); return s + (p ? Number(p.price) * l.qty : 0); }, 0);
  const profit = validLines.reduce((s, l) => { const p = products.find((p) => p.id === l.productId); return s + (p ? (Number(p.price) - Number(p.cost)) * l.qty : 0); }, 0);

  const submit = async () => {
    setError("");
    if (!customerId && !newCustomerName.trim()) return setError("Select or enter a customer.");
    if (validLines.length === 0) return setError("Add at least one product line.");
    for (const l of validLines) {
      const p = products.find((p) => p.id === l.productId);
      if (l.qty > p.stock) return setError(`Not enough stock for ${p.name} (${p.spec}) — only ${p.stock} available.`);
    }
    setSubmitting(true);
    try {
      await onCreate({
        customerId: customerId || undefined,
        customerName: !customerId ? newCustomerName.trim() : undefined,
        items: validLines.map((l) => ({ productId: l.productId, qty: l.qty })),
        code: code.trim() || undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">New Order</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>
        <label className="text-xs text-zinc-500 uppercase tracking-wide font-mono block mb-1">Customer</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm mb-2 focus:outline-none focus:border-amber-500">
          <option value="">— New customer —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!customerId && (
          <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="New customer name"
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm mb-4 focus:outline-none focus:border-amber-500" />
        )}
        <label className="text-xs text-zinc-500 uppercase tracking-wide font-mono block mb-1">Items</label>
        <div className="space-y-2 mb-2">
          {lines.map((line, idx) => {
            const p = products.find((p) => p.id === line.productId);
            return (
              <div key={idx} className="flex gap-2 items-center">
                <select value={line.productId} onChange={(e) => updateLine(idx, "productId", e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500">
                  <option value="">Select product…</option>
                  {products.map((p) => <option key={p.id} value={p.id} disabled={p.stock === 0}>{p.name} ({p.spec}) — {p.stock} in stock</option>)}
                </select>
                <input type="number" min={1} max={p?.stock || 1} value={line.qty} onChange={(e) => updateLine(idx, "qty", Number(e.target.value))}
                  className="w-16 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500" />
                <button onClick={() => removeLine(idx)} className="text-zinc-500 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
        <button onClick={addLine} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mb-4"><Plus size={12} /> Add another item</button>
        <label className="text-xs text-zinc-500 uppercase tracking-wide font-mono block mb-1">Affiliate / promo code (optional)</label>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. SARAH10"
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm mb-1 font-mono uppercase focus:outline-none focus:border-amber-500" />
        <p className="text-[11px] text-zinc-500 mb-4">Applies the affiliate's discount to this sale and credits their commission.</p>
        <div className="bg-zinc-950 border border-zinc-800 rounded p-3 mb-3 flex justify-between text-sm">
          <div><div className="text-zinc-500 text-xs">Order Total</div><div className="font-mono font-semibold">{money(total)}</div></div>
          <div className="text-right"><div className="text-zinc-500 text-xs">Profit</div><div className="font-mono font-semibold text-green-400">{money(profit)}</div></div>
        </div>
        {error && <div className="text-red-400 text-xs mb-3">{error}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded border border-zinc-700 text-sm hover:bg-zinc-800">Cancel</button>
          <button onClick={submit} disabled={submitting} className="flex-1 py-2 rounded bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400 disabled:opacity-50">
            {submitting ? "Creating…" : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Customers({ customers, orders, refreshAll, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  const addCustomer = async () => {
    if (!form.name.trim()) return;
    try {
      await apiFetch("/api/customers", { method: "POST", body: form });
      await refreshAll();
      setForm({ name: "", email: "", phone: "", notes: "" });
      setShowForm(false);
      showToast("Customer added");
    } catch (err) {
      showToast(err.message);
    }
  };

  const customerOrders = (id) => orders.filter((o) => o.customerId === id && o.status === "paid").sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Customers</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{customers.length} customer{customers.length !== 1 ? "s" : ""} on file.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-amber-500 text-zinc-900 font-semibold text-sm px-3 py-2 rounded hover:bg-amber-400">
          <Plus size={15} /> Add Customer
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">No customers yet. They're also added automatically when you create an order.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {customers.map((c) => {
            const custOrders = customerOrders(c.id);
            const spent = custOrders.reduce((s, o) => s + Number(o.total), 0);
            return (
              <button key={c.id} onClick={() => setSelected(c)} className="text-left bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-amber-500/50 transition-colors">
                <div className="font-semibold">{c.name}</div>
                {c.email && <div className="text-zinc-500 text-xs mt-0.5">{c.email}</div>}
                <div className="flex justify-between mt-3 text-xs">
                  <span className="text-zinc-500">{custOrders.length} order{custOrders.length !== 1 ? "s" : ""}</span>
                  <span className="font-mono text-amber-400">{money(spent)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Customer</h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
              <input placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
              <input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
              <textarea placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" rows={2} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded border border-zinc-700 text-sm hover:bg-zinc-800">Cancel</button>
              <button onClick={addCustomer} className="flex-1 py-2 rounded bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400">Add</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
            </div>
            {selected.email && <div className="text-zinc-400 text-sm">{selected.email}</div>}
            {selected.phone && <div className="text-zinc-400 text-sm">{selected.phone}</div>}
            {selected.notes && <div className="text-zinc-500 text-xs mt-2 italic">{selected.notes}</div>}
            <h4 className="text-xs uppercase tracking-wide text-zinc-500 font-mono mt-4 mb-2">Order History</h4>
            {customerOrders(selected.id).length === 0 ? <p className="text-zinc-500 text-sm">No orders yet.</p> : (
              <div className="space-y-2">
                {customerOrders(selected.id).map((o) => (
                  <div key={o.id} className="border-t border-zinc-800 pt-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400 text-xs">{new Date(o.createdAt).toLocaleDateString()}</span>
                      <span className="font-mono">{money(o.total)}</span>
                    </div>
                    <div className="text-zinc-500 text-xs">{o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Affiliates({ showToast }) {
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", code: "", discountPct: 10, commissionPct: 10 });

  const pct = (r) => Math.round(Number(r) * 100);

  const load = async () => {
    try { setAffiliates(await apiFetch("/api/affiliates")); }
    catch (err) { showToast(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) { showToast("Name is required"); return; }
    setBusy(true);
    try {
      await apiFetch("/api/affiliates", { method: "POST", body: {
        name: form.name.trim(), email: form.email.trim(), code: form.code.trim(),
        discountRate: Number(form.discountPct) / 100, commissionRate: Number(form.commissionPct) / 100,
      }});
      setForm({ name: "", email: "", code: "", discountPct: 10, commissionPct: 10 });
      setShowForm(false);
      await load();
      showToast("Affiliate created");
    } catch (err) { showToast(err.message); }
    finally { setBusy(false); }
  };

  const openDetail = async (id) => {
    try { setSelected(await apiFetch(`/api/affiliates/${id}`)); }
    catch (err) { showToast(err.message); }
  };

  const toggleStatus = async (a) => {
    try {
      await apiFetch(`/api/affiliates/${a.id}`, { method: "PATCH", body: { status: a.status === "active" ? "paused" : "active" } });
      await load();
      if (selected && selected.id === a.id) await openDetail(a.id);
      showToast(a.status === "active" ? "Affiliate paused" : "Affiliate reactivated");
    } catch (err) { showToast(err.message); }
  };

  const markPaid = async (a) => {
    try {
      const r = await apiFetch(`/api/affiliates/${a.id}/mark-paid`, { method: "POST" });
      await load();
      if (selected && selected.id === a.id) await openDetail(a.id);
      showToast(`Marked ${r.markedPaid} commission${r.markedPaid !== 1 ? "s" : ""} paid`);
    } catch (err) { showToast(err.message); }
  };

  const copyCode = (code) => { navigator.clipboard?.writeText(code); showToast(`Copied ${code}`); };

  const totalSales = affiliates.reduce((s, a) => s + Number(a.totalSales || 0), 0);
  const totalOwed = affiliates.reduce((s, a) => s + Number(a.commissionOwed || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Affiliates</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Influencer codes — a discount for customers, commission for the promoter.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-amber-500 text-zinc-900 font-semibold text-sm px-3 py-2 rounded hover:bg-amber-400">
          <Plus size={15} /> Add Affiliate
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Affiliates" value={affiliates.length} icon={Users} />
        <StatCard label="Sales via codes" value={money(totalSales)} icon={TrendingUp} />
        <StatCard label="Commission owed" value={money(totalOwed)} icon={DollarSign} accent="text-emerald-400" />
      </div>

      {loading ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">Loading…</div>
      ) : affiliates.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">No affiliates yet. Add your first promoter to generate their code.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {affiliates.map((a) => (
            <div key={a.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => openDetail(a.id)} className="text-left min-w-0">
                  <div className="font-semibold truncate">{a.name}</div>
                  {a.email && <div className="text-zinc-500 text-xs mt-0.5 truncate">{a.email}</div>}
                </button>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${a.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700/40 text-zinc-400"}`}>{a.status}</span>
              </div>
              <button onClick={() => copyCode(a.code)} title="Copy code" className="mt-3 inline-flex items-center gap-1.5 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 font-mono text-sm text-amber-400 hover:border-amber-500">{a.code}</button>
              <div className="text-[11px] text-zinc-500 mt-1">{pct(a.discountRate)}% off · {pct(a.commissionRate)}% commission</div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div><div className="font-mono text-sm">{a.paidOrders}</div><div className="text-[10px] text-zinc-500 uppercase">Orders</div></div>
                <div><div className="font-mono text-sm text-amber-400">{money(a.totalSales)}</div><div className="text-[10px] text-zinc-500 uppercase">Sales</div></div>
                <div><div className="font-mono text-sm text-emerald-400">{money(a.commissionOwed)}</div><div className="text-[10px] text-zinc-500 uppercase">Owed</div></div>
              </div>
              <button onClick={() => openDetail(a.id)} className="w-full mt-3 text-xs text-zinc-400 hover:text-amber-400 border-t border-zinc-800 pt-2 flex items-center justify-center gap-1">Manage <ChevronRight size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Affiliate</h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
              <input placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
              <input placeholder="Code (blank = auto from name)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-amber-500" />
              <div className="flex gap-3">
                <label className="flex-1 text-xs text-zinc-400">Discount %
                  <input type="number" min="0" max="100" value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: e.target.value })} className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
                </label>
                <label className="flex-1 text-xs text-zinc-400">Commission %
                  <input type="number" min="0" max="100" value={form.commissionPct} onChange={(e) => setForm({ ...form, commissionPct: e.target.value })} className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded border border-zinc-700 text-sm hover:bg-zinc-800">Cancel</button>
              <button onClick={create} disabled={busy} className="flex-1 py-2 rounded bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400 disabled:opacity-50">{busy ? "Creating…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
            </div>
            {selected.email && <div className="text-zinc-400 text-sm">{selected.email}</div>}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={() => copyCode(selected.code)} className="inline-flex items-center gap-1.5 bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 font-mono text-sm text-amber-400 hover:border-amber-500">{selected.code}</button>
              <span className="text-xs text-zinc-500">{pct(selected.discountRate)}% off · {pct(selected.commissionRate)}% commission</span>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => toggleStatus(selected)} className="flex-1 py-2 rounded border border-zinc-700 text-sm hover:bg-zinc-800">{selected.status === "active" ? "Pause code" : "Reactivate"}</button>
              <button onClick={() => markPaid(selected)} className="flex-1 py-2 rounded bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500">Mark commissions paid</button>
            </div>
            <h4 className="text-xs uppercase tracking-wide text-zinc-500 font-mono mt-5 mb-2">Orders with this code</h4>
            {(!selected.orders || selected.orders.length === 0) ? <p className="text-zinc-500 text-sm">No orders yet.</p> : (
              <div className="space-y-2">
                {selected.orders.map((o) => (
                  <div key={o.id} className="border-t border-zinc-800 pt-2 text-sm flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-zinc-300 truncate">{o.customer?.name || "Customer"}</div>
                      <div className="text-zinc-500 text-xs">{new Date(o.createdAt).toLocaleDateString()} · <span className={o.status === "paid" ? "text-emerald-400" : o.status === "pending" ? "text-amber-400" : "text-zinc-500"}>{o.status}</span></div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="font-mono">{money(o.total)}</div>
                      <div className="text-[11px] text-emerald-400 font-mono">+{money(o.commissionAmount)}{o.commissionPaid ? " ✓" : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
