import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HoverCard, HoverCardTrigger, HoverCardContent } from './ui/hover-card'
import { catalogAPI } from '../services/api'
import './DeviceCard.css'

function DeviceCard({ device }) {
  const navigate = useNavigate()
  const [variants, setVariants] = useState([])
  const [loadingVariants, setLoadingVariants] = useState(false)

  if (!device) {
    return null
  }

  const handleClick = () => {
    const cpsId = device.cps_id
    if (!cpsId) {
      console.error('Device missing cps_id:', device)
      return
    }
    // Always navigate to group chooser - it will auto-redirect if only one variant
    navigate(`/group/${cpsId}`)
  }

  const handleHover = async () => {
    if (device.count > 1 && device.cps_id && variants.length === 0 && !loadingVariants) {
      setLoadingVariants(true)
      try {
        const response = await catalogAPI.getVariants(device.cps_id, false)
        if (response.success) {
          setVariants(response.data.items || [])
        }
      } catch (error) {
        console.error('Failed to load variants for hover:', error)
      } finally {
        setLoadingVariants(false)
      }
    }
  }
  
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="device-card" onClick={handleClick} onMouseEnter={handleHover}>
          <div className="card-image">
            {device.sample_image_url ? (
              <img src={device.sample_image_url} alt={device.model || 'Device'} />
            ) : (
              <div className="no-image">No Image</div>
            )}
          </div>
          <div className="card-content">
            <h3>{device.model || 'Unknown Model'}</h3>
            <p className="vendor">{device.vendor || 'Unknown Vendor'}</p>
            <div className="card-meta">
              <span className="cps-id">CPS-ID: {device.cps_id}</span>
              {device.count > 1 && (
                <span className="variant-count">{device.count} variants</span>
              )}
            </div>
          </div>
        </div>
      </HoverCardTrigger>
      {device.count > 1 && (
        <HoverCardContent className="w-80">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">CPS Vectors for {device.cps_id}</h4>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {loadingVariants ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : variants.length > 0 ? (
                variants.map((variant, idx) => (
                  <div key={variant.device_uuid || idx} className="text-sm py-1 border-b last:border-b-0">
                    <p className="font-medium">{variant.cps_vector || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">
                      {variant.model || 'Unknown Model'} - {variant.vendor || 'Unknown Vendor'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No variants found</p>
              )}
            </div>
          </div>
        </HoverCardContent>
      )}
    </HoverCard>
  )
}

export default DeviceCard

