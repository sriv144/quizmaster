import { apiClient } from "@quizmaster/api-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { AuthFrame } from "../components/auth-frame.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const request = useMutation({ mutationFn: apiClient.forgotPassword });
  return (
    <AuthFrame eyebrow="Account recovery" title="Reset your password" description="We’ll send a private, time-limited reset link if the account exists." footer={<Link to="/login">Return to sign in</Link>}>
      {request.isSuccess ? <div className="notice success">{request.data.message}</div> : (
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); request.mutate(email); }}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <button className="button primary wide" disabled={request.isPending}>Send reset link</button>
        </form>
      )}
    </AuthFrame>
  );
}
