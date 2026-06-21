import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "./db";
import { db, hybridSignIn, supabase } from "./db"; 

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isFirstRun: boolean; 
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  registerMasterAccount: (username: string, displayName: string, passwordHash: string) => Promise<{ success: boolean; error?: string }>; 
  isAdmin: boolean;
  isManager: boolean;
  isCashier: boolean;
  canApprove: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(false); 

  const checkFirstRunStatus = async () => {
    const userCount = await db.users.count();
    setIsFirstRun(userCount === 0);
  };

  useEffect(() => {
    const initAuth = async () => {
      await checkFirstRunStatus();

      const stored = localStorage.getItem("pos_session");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.userId) {
            const u = await db.users.get(parsed.userId);
            if (u && u.isActive) {
              setUser(u);
            } else {
              localStorage.removeItem("pos_session");
            }
          }
        } catch {
          localStorage.removeItem("pos_session");
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Updated to use our secure local-first smart hybrid engine
  const login = async (username: string, password: string) => {
    const result = await hybridSignIn(username, password);
    
    if (!result.user) {
      return { success: false, error: "Invalid username or password" };
    }
    
    if (!result.user.isActive) {
      return { success: false, error: "Account is disabled" };
    }
    
    setUser(result.user);
    localStorage.setItem("pos_session", JSON.stringify({ userId: result.user.id, username: result.user.username }));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("pos_session");
    supabase.auth.signOut().catch(() => {/* Handle silently if offline */});
  };

  const registerMasterAccount = async (username: string, displayName: string, passwordRaw: string) => {
    try {
      const userCount = await db.users.count();
      if (userCount > 0) {
        return { success: false, error: "Master Account already configured." };
      }

      const cleanUsername = username.toLowerCase().trim();
      const email = cleanUsername.includes("@") ? cleanUsername : `${cleanUsername}@cashfs.com`;
      const generatedUserId = window.crypto.randomUUID();

      // 1. Attempt Global Cloud Sync Setup via Supabase Auth
      try {
        await supabase.auth.signUp({
          email: email,
          password: passwordRaw,
          options: {
            data: {
              displayName: displayName.trim(),
              role: "admin",
              avatarColor: "#D4AF37"
            }
          }
        });
      } catch (cloudErr) {
        console.warn("Cloud registration skipped or offline. Initializing local master profile only.");
      }

      // 2. Local Fallback Database Initialization (Kept exact)
      const salt = window.crypto.randomUUID();
      const encoder = new TextEncoder();
      const data = encoder.encode(passwordRaw + salt);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const AVATAR_COLORS = ["#D4AF37", "#E11D2E", "#1E5BCB", "#2D8A4E", "#8B5CF6", "#F59E0B"];

      const newUserId = await db.users.add({
        id: generatedUserId,
        username: cleanUsername,
        passwordHash: `${computedHash}:${salt}`,
        displayName: displayName.trim(),
        role: "admin", 
        avatarColor: AVATAR_COLORS[0],
        isActive: true,
        createdAt: new Date(),
      });

      const managedUser = await db.users.get(newUserId);
      if (managedUser) {
        setUser(managedUser);
        localStorage.setItem("pos_session", JSON.stringify({ userId: managedUser.id, username: managedUser.username }));
      }

      setIsFirstRun(false); 
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to save master credentials." };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isFirstRun, 
        login,
        logout,
        registerMasterAccount, 
        isAdmin: user?.role === "admin",
        isManager: user?.role === "manager",
        isCashier: user?.role === "cashier",
        canApprove: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
