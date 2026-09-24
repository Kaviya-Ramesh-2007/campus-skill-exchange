import { Alert, Card } from '@campus-skill-exchange/ui';
import { AppShell } from '../../components/layout/app-shell';

export const metadata = { title: 'Infrastructure health' };

export default function HealthPage() {
  return (
    <AppShell>
      <div>
        <div className="page-heading">
          <p className="eyebrow">Infrastructure</p>
          <h1>Health endpoints</h1>
          <p>
            The web shell is running. The API exposes real infrastructure checks under the versioned
            API prefix.
          </p>
        </div>
        <div className="content-stack">
          <Card title="API liveness" description="Checks the running API process.">
            <code className="code-block">GET /api/v1/health</code>
          </Card>
          <Card title="API readiness" description="Checks required PostgreSQL connectivity.">
            <code className="code-block">GET /api/v1/ready</code>
          </Card>
          <Alert severity="info" title="No product integrations">
            Google Meet, payments, email, storage providers, and AI are not connected during
            Foundation.
          </Alert>
        </div>
      </div>
    </AppShell>
  );
}
