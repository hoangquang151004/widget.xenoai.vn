"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const menuItems = [
  {
    label: "Tổng quan",
    icon: "dashboard",
    href: "/dashboard",
  },
  {
    label: "Lịch sử hội thoại",
    icon: "chat_bubble_outline",
    href: "/dashboard/conversations",
  },
  {
    label: "Cơ sở tri thức (RAG)",
    icon: "database",
    href: "/dashboard/knowledge-base",
  },
  {
    label: "Cơ sở dữ liệu (SQL)",
    icon: "table_chart",
    href: "/dashboard/database",
  },
  {
    label: "Đơn hàng & Lead",
    icon: "shopping_cart",
    href: "/dashboard/orders",
  },
  {
    label: "Widget bán hàng",
    icon: "storefront",
    href: "/dashboard/widget-sales",
  },
  {
    label: "Cấu hình Widget",
    icon: "widgets",
    href: "/dashboard/settings",
  },
  {
    label: "Domain cho widget",
    icon: "public",
    href: "/dashboard/origins",
  },
  {
    label: "Khóa API",
    icon: "vpn_key",
    href: "/dashboard/keys",
  },
  {
    label: "Gói dịch vụ & Thanh toán",
    icon: "payments",
    href: "/dashboard/billing",
  },
];

function formatPlanLabel(plan: string | undefined): string {
  const p = (plan || "starter").toLowerCase();
  if (p === "enterprise_pro") return "Enterprise Pro";
  if (p === "enterprise") return "Enterprise";
  if (p === "pro") return "Pro";
  if (p === "starter") return "Miễn phí";
  return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Miễn phí";
}

export default function Sidebar() {
  const pathname = usePathname();
  const { tenant, logout } = useAuth();

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 z-50 flex flex-col p-4 border-r border-slate-200 bg-slate-50">
      <div className="mb-8 px-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
            psychology
          </span>
        </div>
        <div className="overflow-hidden">
          <h1 className="text-sm font-black text-indigo-700 leading-tight truncate">
            {tenant?.name || "Kỷ nguyên AI"}
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Bảng điều khiển
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-inter text-[13px] ${
                isActive
                  ? "bg-white text-indigo-600 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-indigo-600 hover:translate-x-1 font-medium"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-200">
        <div className="w-full bg-primary/10 text-primary py-3 px-4 rounded-full text-[11px] font-bold mb-4 border border-primary/20 text-center">
          Gói: {formatPlanLabel(tenant?.plan)}
        </div>
        <Link
          href="/dashboard/support"
          className="flex items-center gap-3 px-4 py-2 text-slate-600 hover:text-indigo-600 text-[13px] font-medium"
        >
          <span className="material-symbols-outlined text-[20px]">help</span>
          <span>Hỗ trợ</span>
        </Link>
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:text-error text-[13px] font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
