import { api, apiClient } from "@quizmaster/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/ui.js";

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  active: boolean;
  passwordResetRequired: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { attempts: number };
}

export default function AdminUsers() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "users"], queryFn: apiClient.adminUsers });
  const users = query.data as unknown as AdminUser[] | undefined;
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api(`/admin/users/${id}/active`, { method: "PATCH", body: JSON.stringify({ active }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  return <><PageHeader eyebrow="Account administration" title="Users" description="Disable access immediately without deleting attempt history."/><div className="admin-table users-table"><div className="table-head"><span>User</span><span>Role</span><span>Attempts</span><span>Last login</span><span>Access</span></div>{users?.map((user) => <div className="table-row" key={user.id}><span><strong>{user.displayName ?? "Unnamed user"}</strong><small>{user.email}{user.passwordResetRequired ? " · Reset required" : ""}</small></span><span>{user.role}</span><span>{user._count.attempts}</span><span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}</span><span><button className={user.active ? "toggle active" : "toggle"} aria-label={`${user.active ? "Disable" : "Enable"} ${user.email}`} onClick={() => toggle.mutate({ id: user.id, active: !user.active })}><i/></button></span></div>)}</div></>;
}
