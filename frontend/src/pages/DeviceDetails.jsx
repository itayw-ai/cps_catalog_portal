import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import FieldEditor from '../components/FieldEditor'
import CVETable from '../components/CVETable'
import PatchTable from '../components/PatchTable'
import PreInstalledAppsTable from '../components/PreInstalledAppsTable'
import { catalogAPI } from '../services/api'
import { Button } from '../components/ui/button'
import { ButtonGroup } from '../components/ui/button-group'
import { Spinner } from '../components/ui/spinner'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { ScrollArea } from '../components/ui/scroll-area'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import './DeviceDetails.css'

// Special field configurations that override schema detection
const SPECIAL_FIELD_CONFIG = {
  category: { type: 'select', options: ['OT', 'IoT', 'IT','Medical'] },
  // device_type will be handled dynamically by the backend based on cps.device_type_family enum
  is_eol: { type: 'select', options: ['Yes', 'No'] },
  potential_cves: { type: 'cve_table' },
  certified_patches: { type: 'patch_table' },
  pre_installed_applications: { type: 'apps_table' },
  patching_responsibility: { type: 'select', options: ['Vendor', 'User', 'Shared'] },
  network_type: { type: 'multiselect', options: ['Nested', 'Ethernet', 'Wireless', 'Serial'] },
}

// Fields that should not be editable
const NON_EDITABLE_FIELDS = ['vendor', 'model', 'cps_id', 'cps_vector', 'hw_versions', 'sw_versions', 'os_names', 'os_versions', 'os_revisions']

// Fields that should not be displayed at all (blacklist)
const BLACKLISTED_FIELDS = ['needs_vendor', 'risk_score']

// Priority order for field display
const PRIORITY_FIELDS = ['vendor', 'model', 'cps_id', 'manufacturer_product_code', 'cps_vector', 'category', 'device_type', 'is_eol', 'potential_cves', 'certified_patches', 'patching_responsibility', 'pre_installed_applications',
  'network_type', 'links', 'image_url'
]

function DeviceDetails() {
  const { deviceUuid } = useParams()
  const navigate = useNavigate()
  const [device, setDevice] = useState(null)
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(true)
  const [validatedOnly, setValidatedOnly] = useState(false)
  const [schema, setSchema] = useState(null)
  const [variantCount, setVariantCount] = useState(0)
  const [changesOverTime, setChangesOverTime] = useState([])

  useEffect(() => {
    loadSchema()
  }, [])

  useEffect(() => {
    if (schema) {
      loadDevice()
    }
  }, [deviceUuid, validatedOnly, schema])

  const loadSchema = async () => {
    try {
      const response = await catalogAPI.getSchema()
      if (response.success) {
        setSchema(response.data)
      }
    } catch (error) {
      console.error('Failed to load schema:', error)
    }
  }

  const loadDevice = async () => {
    setLoading(true)
    try {
      const [deviceResponse, overridesResponse, changesResponse] = await Promise.all([
        catalogAPI.getDevice(deviceUuid, validatedOnly),
        catalogAPI.getOverrides(deviceUuid),
        catalogAPI.getDeviceChangesOverTime(deviceUuid, 7),
      ])

      if (deviceResponse.success) {
        setDevice(deviceResponse.data)
        // Load variants count if we have a cps_id
        if (deviceResponse.data?.cps_id) {
          try {
            const variantsResponse = await catalogAPI.getVariants(deviceResponse.data.cps_id, validatedOnly)
            if (variantsResponse.success) {
              setVariantCount(variantsResponse.data.items?.length || 0)
            }
          } catch (error) {
            console.error('Failed to load variants:', error)
          }
        }
      }
      if (overridesResponse.success) {
        setOverrides(overridesResponse.data)
      }
      if (changesResponse.success) {
        setChangesOverTime(changesResponse.data)
      }
    } catch (error) {
      console.error('Failed to load device:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFieldSave = (fieldName, newValue) => {
    // Update local device state optimistically
    setDevice((prev) => ({ ...prev, [fieldName]: newValue }))
    // Reload to get fresh data
    loadDevice()
  }

  const getFieldMetadata = (fieldName) => {
    // Check for special configuration first
    if (SPECIAL_FIELD_CONFIG[fieldName]) {
      return {
        label: fieldName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        ...SPECIAL_FIELD_CONFIG[fieldName]
      }
    }
    
    // Use schema metadata if available
    if (schema && schema[fieldName]) {
      const schemaInfo = schema[fieldName]
      return {
        label: fieldName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        type: schemaInfo.type,
        ...schemaInfo.metadata
      }
    }
    
    // Fallback
    return {
      label: fieldName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      type: 'text'
    }
  }

  if (loading || !schema) {
    return (
      <div className="loading flex items-center justify-center gap-2">
        <Spinner className="h-5 w-5" />
        <span>Loading device...</span>
      </div>
    )
  }

  if (!device) {
    return <div className="error">Device not found</div>
  }

  // Filter out system fields and blacklisted fields
  const deviceFields = Object.keys(device).filter(
    (f) => !['created_at', 'updated_at', 'device_uuid', ...BLACKLISTED_FIELDS].includes(f)
  )

  const sortedFields = [
    ...PRIORITY_FIELDS.filter((f) => deviceFields.includes(f) && !BLACKLISTED_FIELDS.includes(f)),
    ...deviceFields.filter((f) => !PRIORITY_FIELDS.includes(f) && !BLACKLISTED_FIELDS.includes(f)).sort(),
  ]

  return (
    <div className="device-details">
      <div className="details-header">
        <ButtonGroup className="header-buttons">
          {variantCount > 1 && device.cps_id && (
            <Button variant="outline" onClick={() => navigate(`/group/${device.cps_id}`)}>
              ← Back to Variants
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/')}>
            ← Back to Catalog
          </Button>
        </ButtonGroup>
        <h1>{device.model || 'Device Details'}</h1>
        <div className="flex items-center space-x-2">
          <Switch
            id="validated-only"
            checked={validatedOnly}
            onCheckedChange={setValidatedOnly}
          />
          <Label htmlFor="validated-only" className="text-white">Validated Only</Label>
        </div>
      </div>

      <div className="details-content">
        {device.image_url && (
          <div className="device-image-section">
            <h2>Device Image</h2>
            <img src={device.image_url} alt={device.model} className="device-image" />
          </div>
        )}

        <div className="fields-section">
          <h2>Device Fields</h2>
          <div className="fields-grid">
            {sortedFields.map((fieldName) => {
              const metadata = getFieldMetadata(fieldName)
              
              // Handle special table components
              if (metadata.type === 'cve_table') {
                return (
                  <CVETable
                    key={fieldName}
                    deviceUuid={device.device_uuid}
                    cpsId={device.cps_id}
                    currentValue={device[fieldName]}
                    onSave={handleFieldSave}
                  />
                )
              }
              
              if (metadata.type === 'patch_table') {
                return (
                  <PatchTable
                    key={fieldName}
                    deviceUuid={device.device_uuid}
                    cpsId={device.cps_id}
                    currentValue={device[fieldName]}
                    onSave={handleFieldSave}
                  />
                )
              }
              
              if (metadata.type === 'apps_table') {
                return (
                  <PreInstalledAppsTable
                    key={fieldName}
                    deviceUuid={device.device_uuid}
                    cpsId={device.cps_id}
                    currentValue={device[fieldName]}
                    onSave={handleFieldSave}
                  />
                )
              }
              
              return (
                <FieldEditor
                  key={fieldName}
                  fieldName={fieldName}
                  fieldLabel={metadata.label}
                  fieldType={metadata.type}
                  currentValue={device[fieldName]}
                  metadata={metadata}
                  deviceUuid={device.device_uuid}
                  cpsId={device.cps_id}
                  onSave={handleFieldSave}
                  nonEditableFields={NON_EDITABLE_FIELDS}
                />
              )
            })}
          </div>
        </div>

        <div className="overrides-section">
          <h2>Override History</h2>
          {overrides.length === 0 ? (
            <p className="no-overrides">No overrides for this device</p>
          ) : (
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <div className="overrides-list">
                {overrides.map((override) => {
                const formatValue = (fieldName, value) => {
                  if (!value) return 'N/A'
                  
                  // Handle JSON arrays for CVEs, patches, and apps
                  if (fieldName === 'potential_cves' || fieldName === 'certified_patches' || fieldName === 'pre_installed_applications') {
                    try {
                      const parsed = JSON.parse(value)
                      if (Array.isArray(parsed)) {
                        if (fieldName === 'potential_cves') {
                          return (
                            <ul className="list-disc list-inside space-y-1">
                              {parsed.map((item, idx) => (
                                <li key={idx}>
                                  {item.cve || item.CVE || 'N/A'} - {item.relevance || 'N/A'}
                                </li>
                              ))}
                            </ul>
                          )
                        } else if (fieldName === 'certified_patches') {
                          return (
                            <ul className="list-disc list-inside space-y-1">
                              {parsed.map((item, idx) => (
                                <li key={idx}>
                                  KB: {item.kb || item.KB || 'N/A'} - Link: {item.link || item.Link || 'N/A'}
                                </li>
                              ))}
                            </ul>
                          )
                        } else if (fieldName === 'pre_installed_applications') {
                          return (
                            <ul className="list-disc list-inside space-y-1">
                              {parsed.map((item, idx) => (
                                <li key={idx}>
                                  {item.app || item.App || 'N/A'} - {item.relevance || 'N/A'}
                                </li>
                              ))}
                            </ul>
                          )
                        }
                      }
                    } catch (e) {
                      // Not JSON, return as-is
                    }
                  }
                  return <span className="override-value">{value}</span>
                }
                
                return (
                  <div key={override.id} className="override-item">
                    <div className="override-header">
                      <strong>{override.field_name}</strong>
                      <span className="override-date">
                        {new Date(override.changed_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="override-body">
                      <p>New Value: {formatValue(override.field_name, override.new_value)}</p>
                      <p>Editor: {override.editor_user_name || 'N/A'}</p>
                      {override.apply_for_all && (
                        <p className="text-blue-600 font-medium">✓ Applied to all devices with same CPS-ID</p>
                      )}
                      {override.note && <p>Note: {override.note}</p>}
                    </div>
                  </div>
                )
              })}
              </div>
            </ScrollArea>
          )}
        </div>

        {changesOverTime.length > 0 && (
          <div className="chart-section">
            <h2>Changes Over Time (Last 7 Days)</h2>
            <div className="chart-container" style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer>
                <LineChart data={changesOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return `${date.getMonth() + 1}/${date.getDate()}`
                    }}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString()
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#6E34F5" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeviceDetails

