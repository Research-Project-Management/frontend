import ForgotPasswordForm from "~/components/auth/ForgotPasswordForm";

export function meta() {
  return [{ title: "Forgot Password · Flux" }];
}

export default function ForgotPassword() {
  return <ForgotPasswordForm />;
}
