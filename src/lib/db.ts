import Dexie, { type EntityTable } from "dexie";
import { createClient } from "@supabase/supabase-js";

// --- ENV INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase Client alongside your local DB
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- TYPE DEFINITIONS (Kept exact) ---
export type UserRole = "admin" | "manager" | "cashier" | "technician";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  fullName?: string;
  phone?: string;
  role: UserRole;
  avatarColor: string;
  isActive: boolean;
  merchantCodeMtn?: string;
  merchantCodeAirtel?: string;
  photo?: string;
  nationalIdFront?: string;
  nationalIdBack?: string;
  createdAt: Date;
}

export interface AppSettings {
  id: "app";
  businessName: string;
  businessLogo?: string;
  fontFamily: string;
  fontSize: number;
  theme: "dark" | "light";
  rolePermissions?: Partial<Record<UserRole, string[]>>;
}

export const defaultSettings: AppSettings = {
  id: "app",
  businessName: "CASHFS",
  fontFamily: "Inter",
  fontSize: 14,
  theme: "dark",
};

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minStock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  id: string;
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  total: number;
  module?: "electronics" | "digital" | "service";
  subType?: string;
}

export interface SaleEditEntry {
  at: Date;
  by: string;
  byName: string;
  reason: string;
  changes: string;
}

export interface Sale {
  id: string;
  billId?: string;
  type: "electronics" | "digital" | "service";
  items: SaleItem[];
  subtotal: number;
  discount: number;
  discountPercent: number;
  tax: number;
  total: number;
  costTotal: number;
  profit: number;
  paymentMethod: "cash" | "stk_push" | "merchant_pay" | "mobile_money" | "card";
  paymentAmount: number;
  change: number;
  customerName?: string;
  customerPhone?: string;
  userId: string;
  userName: string;
  status: "draft" | "completed" | "locked" | "refunded" | "reversed" | "edited";
  mmProvider?: "mtn" | "airtel";
  mmType?: "merchant_pay" | "stk_push";
  mmPhone?: string;
  mmStatus?: "idle" | "prompted" | "waiting_pin" | "confirmed" | "failed";
  mmMerchantCode?: string;
  mmReference?: string;
  refundedAt?: Date;
  refundReason?: string;
  refundedBy?: string;
  reversedAt?: Date;
  reverseReason?: string;
  reversedBy?: string;
  editHistory?: SaleEditEntry[];
  createdAt: Date;
}

export interface DigitalContentItem {
  id: string;
  type: "movie" | "music" | "software" | "game" | "internet";
  name: string;
  price: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "pc_servicing" | "custom";
  isActive: boolean;
  createdAt: Date;
}

export interface Expense {
  id: string;
  category: "rent" | "utilities" | "transport" | "repairs" | "salaries" | "miscellaneous";
  description: string;
  amount: number;
  date: string;
  userId: string;
  userName: string;
  createdAt: Date;
}

export interface ApprovalRequest {
  id: string;
  type: "edit" | "delete";
  recordType: "sale" | "expense" | "product";
  recordId: string;
  originalData: string;
  proposedChanges: string;
  requestedBy: string;
  requestedByName: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedByName?: string;
  reviewNote?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

// --- DEXIE CLASS ---
class PosDatabase extends Dexie {
  users!: EntityTable<User, "id">;
  products!: EntityTable<Product, "id">;
  sales!: EntityTable<Sale, "id">;
  digitalContent!: EntityTable<DigitalContentItem, "id">;
  services!: EntityTable<ServiceItem, "id">;
  expenses!: EntityTable<Expense, "id">;
  approvals!: EntityTable<ApprovalRequest, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor() {
    super("pos-db");
    this.version(2).stores({
      users: "id, username, role",
      products: "id, sku, name, category",
      sales: "id, type, status, userId, createdAt",
      digitalContent: "id, type, name",
      services: "id, category, name",
      expenses: "id, category, date, userId",
      approvals: "id, status, recordType, requestedBy",
      settings: "id",
    });
  }
}

export const db = new PosDatabase();

// --- AUTOMATED SYNC LAYER ---
// Hooks listen to additions/modifications locally and mirror them to the Supabase Cloud
db.products.hook("creating", function (primKey, obj) {
  supabase.from("products").upsert([obj]).then(({ error }) => {
    if (error) console.error("Cloud Sync Error (Product Insert):", error);
  });
});

db.products.hook("updating", function (mods, primKey, obj) {
  const updatedObj = { ...obj, ...mods };
  supabase.from("products").upsert([updatedObj]).then(({ error }) => {
    if (error) console.error("Cloud Sync Error (Product Update):", error);
  });
});

db.sales.hook("creating", function (primKey, obj) {
  supabase.from("sales").upsert([obj]).then(({ error }) => {
    if (error) console.error("Cloud Sync Error (Sale Insert):", error);
  });
});

// --- CLOUD DOWNLOAD ENGINE ---
// Call this function to download what's online directly into your local database
export async function pullCloudData(): Promise<void> {
  try {
    // 1. Pull down missing products
    const { data: cloudProducts, error: prodErr } = await supabase.from("products").select("*");
    if (!prodErr && cloudProducts) {
      await db.products.bulkPut(cloudProducts);
    }

    // 2. Pull down missing sales
    const { data: cloudSales, error: saleErr } = await supabase.from("sales").select("*");
    if (!saleErr && cloudSales) {
      await db.sales.bulkPut(cloudSales);
    }
    
    console.log("Local database successfully synced with online data.");
  } catch (err) {
    console.error("Failed to run cloud download sync:", err);
  }
}

// --- HELPER FUNCTIONS ---
function generateId(): string {
  return crypto.randomUUID();
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function seedDatabase(): Promise<void> {
  console.log("Database initialized. Checking cloud connection status.");
  // Automatically pull fresh online records down right on app bootup
  await pullCloudData();
}

export async function verifyPassword(username: string, password: string): Promise<User | null> {
  const user = await db.users.where("username").equals(username).first();
  if (!user) return null;

  const [storedHash, salt] = user.passwordHash.split(":");
  const computedHash = await hashPassword(password, salt);
  if (computedHash === storedHash) {
    return user;
  }
  return null;
}

export async function createUser(user: Omit<User, "id" | "createdAt">): Promise<string> {
  const id = generateId();
  const salt = crypto.randomUUID();
  const computedHash = await hashPassword(user.passwordHash, salt);

  await db.users.add({ 
    ...user, 
    id, 
    passwordHash: `${computedHash}:${salt}`,
    createdAt: new Date() 
  });
  return id;
}

// --- SECURE SMART HYBRID SIGN IN (Added & Exported) ---
export async function hybridSignIn(usernameOrEmail: string, password: string): Promise<{ user: User | null; source: "cloud" | "local" | "failed" }> {
  const email = usernameOrEmail.includes("@") ? usernameOrEmail : `${usernameOrEmail}@cashfs.com`;
  const plainUsername = usernameOrEmail.split("@")[0];

  try {
    // 1. Try Online Cloud Verification First
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (!error && data?.user) {
      const cloudUser: User = {
        id: data.user.id,
        username: plainUsername,
        passwordHash: "cloud_managed",
        displayName: data.user.user_metadata?.displayName || plainUsername,
        role: (data.user.user_metadata?.role as UserRole) || "cashier",
        avatarColor: data.user.user_metadata?.avatarColor || "#4F46E5",
        isActive: true,
        createdAt: new Date(data.user.created_at),
      };

      // Cache user locally in Dexie for offline use
      await db.users.put(cloudUser);

      return { user: cloudUser, source: "cloud" };
    }
  } catch (netError) {
    console.log("Network down or cloud unreachable. Switching to local offline authentication...");
  }

  // 2. Offline Fallback: Verify via local Dexie DB if cloud is unreachable
  const localUser = await verifyPassword(plainUsername, password);
  if (localUser) {
    return { user: localUser, source: "local" };
  }

  return { user: null, source: "failed" };
}

export function formatUGX(amount: number): string {
  return "UGX " + amount.toLocaleString("en-UG");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
