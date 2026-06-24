import "./globals.css"

export const metadata = {
  title: "RedSea Ledger",
  description: "Maritime Intelligence Dashboard",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b1220] text-white">
        {children}
      </body>
    </html>
  )
}
