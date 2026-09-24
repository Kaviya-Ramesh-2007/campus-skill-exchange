'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input } from '@campus-skill-exchange/ui';
import { useAuth } from './auth-provider';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === 'register';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register({ displayName, email, password });
      } else {
        await login({ email, password });
      }
      router.push('/account');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {error && <Alert severity="error">{error}</Alert>}
      {isRegister && (
        <Input
          id="display-name"
          name="name"
          label="Display name"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      )}
      <Input
        id="email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        hint={isRegister ? 'Use at least 12 characters.' : undefined}
        minLength={isRegister ? 12 : undefined}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {isRegister && (
        <Input
          id="confirm-password"
          name="confirm-password"
          type="password"
          label="Confirm password"
          autoComplete="new-password"
          minLength={12}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      )}
      <Button type="submit" loading={isSubmitting}>
        {isRegister ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
