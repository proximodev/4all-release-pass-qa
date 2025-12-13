import Image from 'next/image'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-dark-gray border-t border-charcol mt-auto">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <Image
            src="/logo.svg"
            alt="4All Digital"
            width={120}
            height={40}
            className="h-8 w-auto"
          />
          <p className="text-white/60 text-sm">
            Copyright © {currentYear} 4All Digital, LLC
          </p>
        </div>
      </div>
    </footer>
  )
}
