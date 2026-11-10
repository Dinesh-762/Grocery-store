import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const res = await register({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      password: form.password,
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Account created!");
      navigate("/");
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="container-app grid min-h-[80vh] place-items-center py-12">
      <div className="w-full max-w-md" data-testid="register-page">
        <div className="card-base p-8">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Create your account</h1>
          <p className="mt-1 text-sm text-[#4A4A4A]">Order fresh groceries in under a minute</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <FormField label="Full name" value={form.name} onChange={update("name")} required testid="register-name" />
            <FormField label="Email" type="email" value={form.email} onChange={update("email")} required testid="register-email" />
            <FormField label="Phone (optional)" value={form.phone} onChange={update("phone")} placeholder="+91..." testid="register-phone" />
            <FormField label="Password" type="password" value={form.password} onChange={update("password")} required testid="register-password" placeholder="At least 6 characters" />

            <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="register-submit">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#4A4A4A]">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-[#1B4332] hover:text-[#E07A5F]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, testid, ...rest }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">{label}</label>
      <input className="input-base" data-testid={testid} {...rest} />
    </div>
  );
}
