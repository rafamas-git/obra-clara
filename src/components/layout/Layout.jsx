import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import Header from './Header'

export default function Layout({ children, title }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} />
        <main className="flex-1 overflow-auto pb-24 md:pb-6">
          <div className="max-w-5xl mx-auto px-4 py-5 md:px-6">
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
