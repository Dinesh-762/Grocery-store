import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Store, Loader2, CheckCircle2 } from "lucide-react";

export default function BecomeVendor() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [f, setF] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    business_name: "",
    business_description: "",
    business_address: "",
    business_pincode: "",
    aadhar_url: "",
    gst_url: "",
    shop_license_url: "",
  });

  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (f.password.length < 6) return toast.error("Password must be at least 6 characters");
    if (!/^\d{6}$/.test(f.business_pincode)) return toast.error("Enter a valid 6-digit pincode");
    setSubmitting(true);
    try {
      await api.post("/vendors/register", {
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        password: f.password,
        phone: f.phone.trim(),
        business_name: f.business_name.trim(),
        business_description: f.business_description.trim(),
        business_address: f.business_address.trim(),
        business_pincode: f.business_pincode.trim(),
        docs: {
          aadhar_url: f.aadhar_url.trim(),
          gst_url: f.gst_url.trim(),
          shop_license_url: f.shop_license_url.trim(),
        },
      });
      setSubmitted(true);
      toast.success("Application submitted!");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="container-app grid min-h-[70vh] place-items-center py-12" data-testid="vendor-submitted">
        <div className="card-base max-w-lg p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-heading text-3xl font-bold">Application received</h1>
          <p className="mt-3 text-[#4A4A4A]">
            Thanks for applying to sell on Ambajogai Grocery! Our admin team will review your documents shortly.
            You&apos;ll be able to log in and access your Vendor Dashboard once approved.
          </p>
          <button onClick={() => navigate("/")} className="btn-primary mt-8">Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app py-12" data-testid="become-vendor-page">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#1B4332] text-white">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-heading text-4xl font-bold">Become a Vendor</h1>
          <p className="mx-auto mt-3 max-w-xl text-[#4A4A4A]">
            Sell your fresh produce to Ambajogai households. Submit your application below — we review every
            request within 24 hours.
          </p>
        </div>

        <form onSubmit={submit} className="card-base space-y-8 p-8">
          <FormSection title="Your details">
            <Grid>
              <F label="Full name" value={f.name} onChange={up("name")} required testid="v-name" />
              <F label="Phone" value={f.phone} onChange={up("phone")} required placeholder="+91..." testid="v-phone" />
              <F label="Email" type="email" value={f.email} onChange={up("email")} required testid="v-email" />
              <F label="Password" type="password" value={f.password} onChange={up("password")} required testid="v-password" placeholder="Min 6 characters" />
            </Grid>
          </FormSection>

          <FormSection title="Business details">
            <Grid>
              <F label="Business name" value={f.business_name} onChange={up("business_name")} required testid="v-biz-name" />
              <F label="Pincode" value={f.business_pincode} onChange={up("business_pincode")} required placeholder="431517" testid="v-biz-pincode" />
              <div className="sm:col-span-2">
                <F label="Business address" value={f.business_address} onChange={up("business_address")} required testid="v-biz-address" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">About your business</label>
                <textarea value={f.business_description} onChange={up("business_description")} rows={3} className="input-base resize-none" data-testid="v-biz-desc" placeholder="What do you sell? Organic vegetables? Home-made spices?" />
              </div>
            </Grid>
          </FormSection>

          <FormSection title="Verification documents (image URLs)" subtitle="Provide public/hosted image URLs of your documents. Full file upload will be enabled once Cloudinary is wired.">
            <Grid>
              <F label="Aadhar image URL" value={f.aadhar_url} onChange={up("aadhar_url")} testid="v-aadhar" />
              <F label="GST certificate URL" value={f.gst_url} onChange={up("gst_url")} testid="v-gst" />
              <div className="sm:col-span-2">
                <F label="Shop licence URL" value={f.shop_license_url} onChange={up("shop_license_url")} testid="v-license" />
              </div>
            </Grid>
          </FormSection>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-dashed pt-6 sm:flex-row">
            <p className="text-xs text-[#4A4A4A]">
              Already a vendor?{" "}
              <Link to="/login" className="font-semibold text-[#1B4332] hover:text-[#E07A5F]">Sign in</Link>
            </p>
            <button type="submit" disabled={submitting} className="btn-primary" data-testid="v-submit">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function F({ label, testid, ...rest }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">{label}</label>
      <input className="input-base" data-testid={testid} {...rest} />
    </div>
  );
}
function FormSection({ title, subtitle, children }) {
  return (
    <div>
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-[#4A4A4A]">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
