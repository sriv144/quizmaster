import type { FastifyRequest } from "fastify";
import type { Role } from "../generated/prisma/enums.js";

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  role: Role;
  email: string;
}

export type AuthenticatedRequest = FastifyRequest & { principal: AuthPrincipal };
