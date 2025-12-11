import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { catalogAPI } from '../services/api'
import { Spinner } from '../components/ui/spinner'
import './GroupChooser.css'

function GroupChooser() {
  const { cpsId } = useParams()
  const navigate = useNavigate()
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [validatedOnly, setValidatedOnly] = useState(false)

  useEffect(() => {
    loadVariants()
  }, [cpsId, validatedOnly])

  const loadVariants = async () => {
    setLoading(true)
    try {
      const response = await catalogAPI.getVariants(cpsId, validatedOnly)
      if (response.success) {
        const items = response.data.items
        // Auto-redirect if only one variant
        if (items.length === 1) {
          navigate(`/device/${items[0].device_uuid}`)
          return
        }
        setVariants(items)
      }
    } catch (error) {
      console.error('Failed to load variants:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (deviceUuid) => {
    navigate(`/device/${deviceUuid}`)
  }

  if (loading) {
    return (
      <div className="loading flex items-center justify-center gap-2">
        <Spinner className="h-5 w-5" />
        <span>Loading variants...</span>
      </div>
    )
  }

  return (
    <div className="group-chooser">
      <div className="chooser-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Back to Catalog
        </button>
        <h1>Choose Device for CPS-ID: {cpsId}</h1>
        <label className="toggle-validated">
          <input
            type="checkbox"
            checked={validatedOnly}
            onChange={(e) => setValidatedOnly(e.target.checked)}
          />
          Validated Only
        </label>
      </div>

      <div className="variants-list">
        {variants.map((variant) => (
          <div key={variant.device_uuid} className="variant-card">
            <div className="variant-info">
              <h3>{variant.model || 'Unknown Model'}</h3>
              <p className="vendor">{variant.vendor || 'Unknown Vendor'}</p>
              <p className="vector">Vector: {variant.cps_vector || 'N/A'}</p>
            </div>
            <button
              className="btn-open"
              onClick={() => handleSelect(variant.device_uuid)}
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default GroupChooser

