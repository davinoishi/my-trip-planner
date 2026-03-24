import { Suspense } from "react";
import { LoginForm } from "./login-form";

// Suspense boundary required by Next.js 15 for useSearchParams()
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

