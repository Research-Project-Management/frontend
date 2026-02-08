import RegisterForm from "~/components/auth/RegisterForm";

export function meta() {
  return [
    { title: "Register" },
    { name: "description", content: "Create a new account" },
  ];
}
export default function Register() {
  return <RegisterForm />;
}
