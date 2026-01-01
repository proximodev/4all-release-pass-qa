import ReleasePassPageLayout from '@/components/releasepass/ReleasePassPageLayout'

export default function SiteAuditPage() {
  return (
    <ReleasePassPageLayout
      mode="testRun"
      newTestPath="/releasepass/site-audit/new"
      testType="SITE_AUDIT"
      rightCardTitle="Latest Results"
      emptyMessage="Select a project to get started."
    />
  )
}
