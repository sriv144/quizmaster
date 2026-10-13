import type { User } from "../generated/prisma/client.js";

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    passwordResetRequired: user.passwordResetRequired,
  };
}
