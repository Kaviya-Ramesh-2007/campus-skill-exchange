import Link from 'next/link';
import { Card } from '@campus-skill-exchange/ui';
import { AuthForm } from '../../../../features/auth/auth-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="auth-card-wrap">
      <Card>
        <div className="auth-card__heading">
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in</h1>
          <p>Use your Campus Skill Exchange account to continue.</p>
        </div>
        <AuthForm mode="login" />
        <p className="auth-card__footer">
          New here? <Link href="/auth/register">Create an account</Link>
        </p>
      </Card>
    </div>
  );
}
