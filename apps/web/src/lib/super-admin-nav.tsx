import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Package,
  CreditCard,
  ShieldAlert,
} from 'lucide-react';

export const superAdminNav = [
  { label: 'Platform Dashboard', href: '/super-admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Institutes & Tenants', href: '/super-admin/institutes', icon: <Building2 size={18} /> },
  { label: 'Subscription Plans', href: '/super-admin/plans', icon: <Package size={18} /> },
  { label: 'Platform Billing', href: '/super-admin/billing', icon: <CreditCard size={18} /> },
  { label: 'System Audit Logs', href: '/super-admin/logs', icon: <ShieldAlert size={18} /> },
];

