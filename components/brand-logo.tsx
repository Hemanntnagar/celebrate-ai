import Image from 'next/image'
import Link from 'next/link'

type BrandLogoProps = {
  href?: string
  variant?: 'auth' | 'sidebar' | 'mobile'
}

export function BrandLogo({ href, variant = 'sidebar' }: BrandLogoProps) {
  const content = (
    <>
      <Image
        src="/logo.png"
        alt=""
        width={1015}
        height={335}
        className="brand-logo-full"
        priority
      />
      {variant === 'sidebar' ? (
        <Image
          src="/mark.png"
          alt=""
          width={318}
          height={318}
          className="brand-logo-mark"
          priority
        />
      ) : null}
    </>
  )

  const className = `brand-mark brand-mark-${variant}`
  const label = href ? 'Celebrate AI home' : 'Celebrate AI'

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {content}
      </Link>
    )
  }

  return (
    <div className={className} role="img" aria-label={label}>
      {content}
    </div>
  )
}
