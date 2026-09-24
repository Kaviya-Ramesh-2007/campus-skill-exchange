import Link from 'next/link';
import { EmptyState } from '@campus-skill-exchange/ui';

export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="This route does not exist in the Foundation application shell."
      action={
        <Link className="cse-button cse-button--secondary cse-button--md" href="/">
          Return home
        </Link>
      }
    />
  );
}
