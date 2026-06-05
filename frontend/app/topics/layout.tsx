import { AuthProvider } from "@/contexts/AuthContext";

export default function TopicsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
