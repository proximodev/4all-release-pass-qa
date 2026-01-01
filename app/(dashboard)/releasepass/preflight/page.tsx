import ReleasePassPageLayout from '@/components/releasepass/ReleasePassPageLayout'

export default function PreflightPage() {
  return (
    <ReleasePassPageLayout
      mode="releaseRun"
      newTestPath="/releasepass/preflight/new"
      leftCardTitle="Get Started"
      className="min-h-[440px]"
    />
  )
}
