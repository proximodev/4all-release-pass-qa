import Image from 'next/image'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
      <footer className="bg-black border-t border-charcol mt-auto text-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between text-white text-m">
            <Image
                src="/img/logo-4all.svg"
                alt="4All Digital"
                width={120}
                height={40}
                className="h-8 w-auto"
            />
            <div className="flex items-center gap-x-5 justify-between">
              <a href="/about/releasepass">About ReleasePass</a>
              <a href="#">Confidentiality</a>
            </div>
            <p className="mb-0 text-sm">
              <span>Copyright © {currentYear} 4All Digital, LLC</span>
            </p>
          </div>

          <div className="text-center text-xs pt-10">
            <strong>CONFIDENTIALITY:</strong> ReleasePass and its contents are proprietary and confidential. Unauthorized disclosure is prohibited.
          </div>

        </div>

      </footer>
  )
}
