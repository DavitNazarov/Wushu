'use client';

import { LoginForm } from './_components/LoginForm';
import { LoginShell } from './_components/LoginShell';

export default function LoginPage() {
  return (
    <LoginShell>
      <LoginForm />
    </LoginShell>
  );
}
