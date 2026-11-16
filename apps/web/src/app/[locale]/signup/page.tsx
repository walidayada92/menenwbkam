import { Signup } from "@/components/signup";
export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <Signup locale={(await params).locale} />;
}
