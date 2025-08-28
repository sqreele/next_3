// ./app/dashboard/chartdashboard/page.tsx
import { Suspense } from 'react';
import { fetchJobs } from '@/app/lib/data.server'; // Import from server file
import PropertyJobsDashboard from '@/app/components/jobs/PropertyJobsDashboard';
import { redirect } from 'next/navigation';
import ErrorBoundary from '@/app/components/ErrorBoundary';

export default async function ChartdashboardPage() {
  redirect('/auth/signin');
  const accessToken = '' as any;

  // Fetch data using server-side function
  const jobs = await fetchJobs(accessToken);

  return (
    <div className="space-y-4">
      <ErrorBoundary>
        <Suspense fallback={<div>Loading...</div>}>
          <PropertyJobsDashboard initialJobs={jobs || []} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}