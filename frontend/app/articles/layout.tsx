import { AuthProvider } from "@/contexts/AuthContext";

export default function ArticlesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
