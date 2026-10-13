import { apiClient } from "@quizmaster/api-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AuthFrame } from "../components/auth-frame.js";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const token = params.get("token") ?? "";
  const reset = useMutation({ mutationFn: () => apiClient.resetPassword(token, password) });
  return (
    <AuthFrame eyebrow="Choose a new password" title="Secure your account" description="Reset links expire after 30 minutes and can only be used once." footer={<Link to="/login">Return to sign in</Link>}>
      {reset.isSuccess ? <div className="notice success">{reset.data.message}</div> : (
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); reset.mutate(); }}>
          <label>New password<input type="password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {reset.error && <p className="form-error">{reset.error.message}</p>}
          <button className="button primary wide" disabled={!token || reset.isPending}>Reset password</button>
        </form>
      )}
    </AuthFrame>
  );
}
