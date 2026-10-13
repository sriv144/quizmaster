import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "@quizmaster/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { AuthFrame } from "../components/auth-frame.js";

const schema = z.object({ email: z.email(), password: z.string().min(1) });
type Values = z.infer<typeof schema>;

export function meta() { return [{ title: "Sign in · QuizMaster" }]; }

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const login = useMutation({
    mutationFn: apiClient.login,
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(["auth", "me"], user);
      navigate(user.role === "ADMIN" ? "/admin" : "/app");
    },
  });
  return (
    <AuthFrame eyebrow="Welcome back" title="Sign in to continue" description="Use the email attached to your QuizMaster account." footer={<>New to QuizMaster? <Link to="/register">Create an account</Link></>}>
      <form className="form-stack" onSubmit={form.handleSubmit((values) => login.mutate(values))}>
        <label>Email<input type="email" autoComplete="email" placeholder="you@example.com" {...form.register("email")} /></label>
        {form.formState.errors.email && <p className="field-error">Enter a valid email address.</p>}
        <div className="label-row"><label htmlFor="password">Password</label><Link to="/forgot-password">Forgot password?</Link></div>
        <input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
        {login.error && <p className="form-error" role="alert">{login.error.message}</p>}
        <button className="button primary wide" disabled={login.isPending}>{login.isPending ? "Signing in…" : <>Sign in <ArrowRight size={18} /></>}</button>
      </form>
    </AuthFrame>
  );
}
