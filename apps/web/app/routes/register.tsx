import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "@quizmaster/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { AuthFrame } from "../components/auth-frame.js";

const schema = z.object({
  displayName: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(10).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/),
});
type Values = z.infer<typeof schema>;

export default function Register() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const register = useMutation({
    mutationFn: apiClient.register,
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["auth", "me"], user);
      navigate("/app");
    },
  });
  return (
    <AuthFrame eyebrow="Learner account" title="Create your workspace" description="Your account will always be created with learner access." footer={<>Already registered? <Link to="/login">Sign in</Link></>}>
      <form className="form-stack" onSubmit={form.handleSubmit((values) => register.mutate(values))}>
        <label>Name<input autoComplete="name" {...form.register("displayName")} /></label>
        <label>Email<input type="email" autoComplete="email" {...form.register("email")} /></label>
        <label>Password<input type="password" autoComplete="new-password" {...form.register("password")} /></label>
        <p className="field-help">Use 10+ characters with uppercase, lowercase, and a number.</p>
        {register.error && <p className="form-error" role="alert">{register.error.message}</p>}
        <button className="button primary wide" disabled={register.isPending}>Create account <ArrowRight size={18} /></button>
      </form>
    </AuthFrame>
  );
}
