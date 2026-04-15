import { AuthProvider } from "@/contexts/AuthContext";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
