import { AuthProvider } from '@/contexts/AuthContext';

export default function ExtensionLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
