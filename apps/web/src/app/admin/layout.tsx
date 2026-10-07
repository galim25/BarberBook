import { AdminAutoRefresh } from "./AdminAutoRefresh";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminAutoRefresh />
    </>
  );
}
