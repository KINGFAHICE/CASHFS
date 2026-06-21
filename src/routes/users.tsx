import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, ShieldCheck, Pencil, Upload, User as UserIcon, IdCard } from "lucide-react";
import { db, type User, type UserRole, seedDatabase } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sounds } from "@/lib/sounds";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/users")({
  component: UsersPage,
});

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

import { centerCropSquare, fileToDataUrl, resizeMax } from "@/lib/image";

interface FormState {
  username: string;
  displayName: string;
  fullName: string;
  phone: string;
  password: string;
  role: UserRole;
  merchantCodeMtn: string;
  merchantCodeAirtel: string;
  photo?: string;
  nationalIdFront?: string;
  nationalIdBack?: string;
}

const EMPTY_FORM: FormState = {
  username: "", displayName: "", fullName: "", phone: "", password: "",
  role: "cashier", merchantCodeMtn: "", merchantCodeAirtel: "",
  photo: undefined, nationalIdFront: undefined, nationalIdBack: undefined,
};

export default function UsersPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const photoRef = useRef<HTMLInputElement>(null);
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);

  const loadUsers = useCallback(async () => {
    await seedDatabase();
    const all = await db.users.toArray();
    setUsers(all);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const upload = async (file: File | null, key: "photo" | "nationalIdFront" | "nationalIdBack") => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      sounds.error();
      alert("Image must be under 5 MB");
      return;
    }
    try {
      const raw = await fileToDataUrl(file);
      // Auto center-crop + resize: avatar = square 256, ID = max 900 edge
      const processed =
        key === "photo"
          ? await centerCropSquare(raw, 256)
          : await resizeMax(raw, 900);
      setForm((prev) => ({ ...prev, [key]: processed }));
      sounds.click();
    } catch (e) {
      sounds.error();
      alert("Could not process image");
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.displayName.trim() || !form.fullName.trim() || !form.phone.trim()) {
      sounds.error();
      alert("Username, display name, full name, and phone are required");
      return;
    }
    const salt = crypto.randomUUID();
    const hash = form.password ? await hashPassword(form.password, salt) : "";
    if (editing) {
      const update: Partial<User> = {
        displayName: form.displayName,
        fullName: form.fullName,
        phone: form.phone,
        role: form.role,
        merchantCodeMtn: form.merchantCodeMtn || undefined,
        merchantCodeAirtel: form.merchantCodeAirtel || undefined,
        photo: form.photo,
        nationalIdFront: form.nationalIdFront,
        nationalIdBack: form.nationalIdBack,
      };
      if (form.password) update.passwordHash = `${hash}:${salt}`;
      await db.users.update(editing.id, update);
    } else {
      if (!form.password) { sounds.error(); alert("Password is required for new users"); return; }
      const existing = await db.users.where("username").equals(form.username).first();
      if (existing) { sounds.error(); alert("Username already exists"); return; }
      await db.users.add({
        id: crypto.randomUUID(),
        username: form.username,
        passwordHash: `${hash}:${salt}`,
        displayName: form.displayName,
        fullName: form.fullName,
        phone: form.phone,
        role: form.role,
        avatarColor: ["#D4AF37", "#E11D2E", "#1E5BCB", "#2D8A4E", "#8B5CF6"][Math.floor(Math.random() * 5)],
        isActive: true,
        merchantCodeMtn: form.merchantCodeMtn || undefined,
        merchantCodeAirtel: form.merchantCodeAirtel || undefined,
        photo: form.photo,
        nationalIdFront: form.nationalIdFront,
        nationalIdBack: form.nationalIdBack,
        createdAt: new Date(),
      });
    }
    sounds.success();
    setIsAddOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    loadUsers();
  };

  const handleToggleActive = async (u: User) => {
    if (u.id === user?.id) { sounds.error(); alert("Cannot deactivate yourself"); return; }
    await db.users.update(u.id, { isActive: !u.isActive });
    loadUsers();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Only admins can manage users.</p>
        </div>
      </div>
    );
  }

  const roleBadge = (role: UserRole) => {
    switch (role) {
      case "admin": return "bg-primary/10 text-primary";
      case "manager": return "bg-discount/10 text-discount";
      case "technician": return "bg-blue-500/10 text-blue-500";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Users</h1>
          <p className="text-sm text-muted-foreground">Manage staff accounts, roles, and KYC details</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">KYC</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const kycComplete = !!(u.photo && u.nationalIdFront && u.nationalIdBack);
              return (
                <tr key={u.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.photo ? (
                        <img src={u.photo} alt={u.displayName} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: u.avatarColor }}>
                          {u.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{u.fullName || u.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleBadge(u.role)}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${kycComplete ? "text-profit" : "text-muted-foreground"}`}>
                      {kycComplete ? "Complete" : "Incomplete"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.isActive ? "bg-profit/10 text-profit" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditing(u);
                      setForm({
                        username: u.username,
                        displayName: u.displayName,
                        fullName: u.fullName ?? "",
                        phone: u.phone ?? "",
                        password: "",
                        role: u.role,
                        merchantCodeMtn: u.merchantCodeMtn ?? "",
                        merchantCodeAirtel: u.merchantCodeAirtel ?? "",
                        photo: u.photo,
                        nationalIdFront: u.nationalIdFront,
                        nationalIdBack: u.nationalIdBack,
                      });
                      setIsAddOpen(true);
                    }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full border border-border bg-muted flex items-center justify-center overflow-hidden">
                {form.photo ? (
                  <img src={form.photo} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0] ?? null, "photo")} />
                <Button variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> {form.photo ? "Change Photo" : "Upload Photo"}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1">Under 1.5 MB, stored locally.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {!editing && (
                <div>
                  <label className="text-sm font-medium">Username *</label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
              )}
              <div className={editing ? "col-span-2" : ""}>
                <label className="text-sm font-medium">Display Name *</label>
                <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Full Legal Name *</label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Telephone *</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07xx xxx xxx" />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="cashier">Cashier — sales only</option>
                  <option value="technician">Technician — services + sales</option>
                  <option value="manager">Manager — all except settings/users</option>
                  <option value="admin">Admin — full access</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Password {editing ? "(leave blank to keep)" : "*"}</label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">MTN Merchant Code</label>
                <Input placeholder="e.g. 123456" value={form.merchantCodeMtn} onChange={(e) => setForm({ ...form, merchantCodeMtn: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Airtel Merchant Code</label>
                <Input placeholder="e.g. 654321" value={form.merchantCodeAirtel} onChange={(e) => setForm({ ...form, merchantCodeAirtel: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Merchant codes auto-fill on mobile money collections.</p>

            {/* National ID */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2"><IdCard className="h-4 w-4" /> National ID</label>
              <div className="grid grid-cols-2 gap-3">
                {(["nationalIdFront", "nationalIdBack"] as const).map((key, idx) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{idx === 0 ? "Front" : "Back"}</p>
                    <div className="h-28 rounded-md border border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                      {form[key] ? (
                        <img src={form[key]} alt={key} className="h-full w-full object-cover" />
                      ) : (
                        <IdCard className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      ref={idx === 0 ? idFrontRef : idBackRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => upload(e.target.files?.[0] ?? null, key)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => (idx === 0 ? idFrontRef : idBackRef).current?.click()}
                    >
                      <Upload className="h-3 w-3 mr-1" /> {form[key] ? "Replace" : "Upload"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleSave}>{editing ? "Update User" : "Add User"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
