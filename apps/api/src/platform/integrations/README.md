# Provider boundaries

These are capability interfaces only. Foundation does not implement or connect storage, email, meeting, payment, or AI providers.

Provider adapters must keep credentials server-side, return provider references rather than secrets, handle failures explicitly, and never report fake success.
