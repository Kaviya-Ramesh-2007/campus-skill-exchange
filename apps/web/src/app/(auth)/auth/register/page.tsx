import Link from 'next/link';
import { Card } from '@campus-skill-exchange/ui';
import { AuthForm } from '../../../../features/auth/auth-form';

export const metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <div className="auth-card-wrap">
      <Card>
        <div className="auth-card__heading">
          <p className="eyebrow">Join the exchange</p>
          <h1>Create your account</h1>
          <p>Start with a secure identity. Your learning and teaching activities stay flexible.</p>
        </div>
        <AuthForm mode="register" />
        <p className="auth-card__footer">
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
