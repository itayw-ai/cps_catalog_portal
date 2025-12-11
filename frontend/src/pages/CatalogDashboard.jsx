import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DeviceCard from '../components/DeviceCard'
import { catalogAPI } from '../services/api'
import { Spinner } from '../components/ui/spinner'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { AppBreadcrumb } from '../App'
import './CatalogDashboard.css'

function CatalogDashboard() {
  const [devices, setDevices] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    validated_only: false,
    search_term: '',
    vendor: '',
    category: '',
  })
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null)

  const navigate = useNavigate()

  // Initial load on mount
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced effect for search_term - wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 300) // Wait 300ms after user stops typing
    
    return () => {
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search_term])

  // Immediate load for other filters (validated_only, vendor, category)
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.validated_only, filters.vendor, filters.category])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('Loading catalog data with filters:', filters)
      const [catalogResponse, statsResponse] = await Promise.all([
        catalogAPI.getCatalogGroups(filters),
        catalogAPI.getStats(),
      ])

      console.log('Catalog response:', catalogResponse)
      console.log('Stats response:', statsResponse)

      if (catalogResponse?.success) {
        const deviceData = catalogResponse.data || []
        console.log(`Loaded ${deviceData.length} devices`)
        setDevices(deviceData)
      } else {
        console.error('Catalog API error:', catalogResponse)
        setError('Failed to load catalog: ' + (catalogResponse?.detail || 'Unknown error'))
        setDevices([])
      }
      
      if (statsResponse?.success) {
        setStats(statsResponse.data)
      } else {
        console.warn('Stats API error:', statsResponse)
        // Stats are optional, don't set error for this
      }
    } catch (error) {
      console.error('Failed to load catalog:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      })
      setError(`Failed to load data: ${error.message || 'Network error'}`)
      setDevices([])
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="catalog-dashboard">
      <header className="dashboard-header">
        <div className="header-title">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/fa97d22ad_942fdc42f_image.png" 
            alt="Claroty Logo" 
            className="header-logo"
          />
          <h1>CPS Catalog Portal</h1>
          <div className="ml-4">
            <AppBreadcrumb className="ml-4" textColor="text-white [&>li]:text-white [&_a]:text-white/90 [&_a:hover]:text-white" />
          </div>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/changes')}>All Changes Log</button>
        </div>
      </header>

      <div className="dashboard-content">
        <aside className="filters-panel">
          <h2>Filters</h2>
          
          <div className="filter-group">
            <div className="flex items-center space-x-2">
              <Switch
                id="validated-only"
                checked={filters.validated_only}
                onCheckedChange={(checked) => handleFilterChange('validated_only', checked)}
              />
              <Label htmlFor="validated-only">Validated Only</Label>
            </div>
          </div>

          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search vendor, model, CPS-ID..."
              value={filters.search_term}
              onChange={(e) => handleFilterChange('search_term', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Vendor</label>
            <input
              type="text"
              placeholder="Filter by vendor"
              value={filters.vendor}
              onChange={(e) => handleFilterChange('vendor', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Category</label>
            <input
              type="text"
              placeholder="Filter by category"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            />
          </div>
        </aside>

        <main className="catalog-main">
          {stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.total_devices || 0}</div>
                <div className="stat-label">Total Devices</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.vendors || 0}</div>
                <div className="stat-label">Vendors</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.total_overrides || 0}</div>
                <div className="stat-label">Total Overrides</div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p><strong>Error:</strong> {error}</p>
              <button onClick={() => { setError(null); loadData(); }}>Retry</button>
              <button onClick={() => window.location.reload()} style={{ marginLeft: '8px' }}>Reload Page</button>
            </div>
          )}
          
          {loading ? (
            <div className="loading flex items-center justify-center gap-2">
              <Spinner className="h-5 w-5" />
              <span>Loading devices...</span>
            </div>
          ) : error ? null : Array.isArray(devices) && devices.length === 0 ? (
            <div className="empty">No devices found</div>
          ) : Array.isArray(devices) && devices.length > 0 ? (
            <div className="devices-grid">
              {devices.map((device, index) => (
                device && <DeviceCard key={device.cps_id || `device-${index}`} device={device} />
              ))}
            </div>
          ) : (
            <div className="error-state">
              <p>Failed to load devices. Check browser console for details.</p>
              <button onClick={() => window.location.reload()}>Reload Page</button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default CatalogDashboard

