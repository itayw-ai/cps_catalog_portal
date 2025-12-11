import { Routes, Route, useLocation, Link } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import CatalogDashboard from './pages/CatalogDashboard'
import DeviceDetails from './pages/DeviceDetails'
import ChangesLog from './pages/ChangesLog'
import GroupChooser from './pages/GroupChooser'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './components/ui/breadcrumb'
import './App.css'

export function AppBreadcrumb({ className = "mb-4 px-4 pt-4", textColor = "" }) {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter((x) => x)

  return (
    <Breadcrumb className={className} data-breadcrumb>
      <BreadcrumbList className={textColor || ""}>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Catalog</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`
          const isLast = index === pathnames.length - 1
          const label = value === 'group' ? 'Variants' : value === 'device' ? 'Device Details' : value === 'changes' ? 'Changes Log' : value

          return (
            <div key={to} className="flex items-center">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={to}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function App() {
  const location = useLocation()
  const isCatalogPage = location.pathname === '/'

  return (
    <ErrorBoundary>
      <div className="App">
        {!isCatalogPage && (
          <div className="app-breadcrumb-container" style={{ padding: '16px', background: '#f5f0ff' }}>
            <AppBreadcrumb />
          </div>
        )}
        <Routes>
          <Route path="/" element={<CatalogDashboard />} />
          <Route path="/device/:deviceUuid" element={<DeviceDetails />} />
          <Route path="/group/:cpsId" element={<GroupChooser />} />
          <Route path="/changes" element={<ChangesLog />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}

export default App

