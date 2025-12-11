import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { catalogAPI } from '../services/api'
import { Spinner } from '../components/ui/spinner'
import { ScrollArea } from '../components/ui/scroll-area'
import { Button } from '../components/ui/button'
import { Calendar } from '../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { CalendarIcon, RotateCcw } from 'lucide-react'
import { cn } from '../lib/utils'
import { toast } from 'sonner'
import './ChangesLog.css'

function ChangesLog() {
  const navigate = useNavigate()
  const [allChanges, setAllChanges] = useState([])
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    from: null,
    to: null,
  })
  const [filters, setFilters] = useState({
    editor: '',
    field_name: '',
    vendor: '',
    apply_for_all: null, // null = all, true = only apply_for_all, false = only not apply_for_all
  })
  const [revertDialogOpen, setRevertDialogOpen] = useState(false)
  const [changeToRevert, setChangeToRevert] = useState(null)
  const [reverting, setReverting] = useState(false)

  useEffect(() => {
    loadChanges()
  }, [])

  const loadChanges = async () => {
    setLoading(true)
    try {
      const response = await catalogAPI.getAllChanges(1000)
      if (response.success) {
        setAllChanges(response.data)
        applyFilters(response.data)
      }
    } catch (error) {
      console.error('Failed to load changes:', error)
      toast.error('Failed to load changes')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = (data) => {
    let filtered = [...data]

    // Filter by date range
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter((change) => {
        const changeDate = new Date(change.changed_at)
        if (dateRange.from && changeDate < dateRange.from) return false
        if (dateRange.to) {
          const toDate = new Date(dateRange.to)
          toDate.setHours(23, 59, 59, 999)
          if (changeDate > toDate) return false
        }
        return true
      })
    }

    // Filter by editor
    if (filters.editor) {
      filtered = filtered.filter((change) =>
        (change.editor_user_name || '').toLowerCase().includes(filters.editor.toLowerCase())
      )
    }

    // Filter by field name
    if (filters.field_name) {
      filtered = filtered.filter((change) =>
        (change.field_name || '').toLowerCase().includes(filters.field_name.toLowerCase())
      )
    }

    // Filter by vendor
    if (filters.vendor) {
      filtered = filtered.filter((change) =>
        (change.vendor || '').toLowerCase().includes(filters.vendor.toLowerCase())
      )
    }

    // Filter by apply_for_all
    if (filters.apply_for_all !== null) {
      filtered = filtered.filter((change) => {
        const isApplyForAll = change.apply_for_all === true || change.apply_for_all === 'true'
        return filters.apply_for_all ? isApplyForAll : !isApplyForAll
      })
    }

    // Limit to 30 changes
    const limited = filtered.slice(0, 30)

    setChanges(limited)
  }

  useEffect(() => {
    if (allChanges.length > 0) {
      applyFilters(allChanges)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, filters])

  const handleRevert = async () => {
    if (!changeToRevert) return

    setReverting(true)
    try {
      const response = await catalogAPI.deleteChange(changeToRevert.id)
      if (response.success) {
        toast.success('Change reverted successfully')
        setRevertDialogOpen(false)
        setChangeToRevert(null)
        // Reload changes
        await loadChanges()
      } else {
        toast.error('Failed to revert change')
      }
    } catch (error) {
      console.error('Failed to revert change:', error)
      toast.error('Failed to revert change: ' + (error.response?.data?.detail || error.message))
    } finally {
      setReverting(false)
    }
  }

  const openRevertDialog = (change) => {
    setChangeToRevert(change)
    setRevertDialogOpen(true)
  }

  // Get unique values for filter dropdowns
  const uniqueEditors = [...new Set(allChanges.map(c => c.editor_user_name).filter(Boolean))].sort()
  const uniqueFields = [...new Set(allChanges.map(c => c.field_name).filter(Boolean))].sort()
  const uniqueVendors = [...new Set(allChanges.map(c => c.vendor).filter(Boolean))].sort()

  return (
    <div className="changes-log">
      <div className="log-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Back to Catalog
        </button>
        <h1>All Changes Log</h1>
      </div>

      <div className="log-filters">
        <div className="filters-grid">
          <div className="filter-item">
            <label>Date Range</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={(range) => setDateRange(range || { from: null, to: null })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {(dateRange.from || dateRange.to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateRange({ from: null, to: null })}
                className="mt-1"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="filter-item">
            <label>Editor</label>
            <Select
              value={filters.editor}
              onChange={(e) => setFilters({ ...filters, editor: e.target.value })}
            >
              <option value="">All Editors</option>
              {uniqueEditors.map((editor) => (
                <option key={editor} value={editor}>{editor}</option>
              ))}
            </Select>
            {filters.editor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ ...filters, editor: '' })}
                className="mt-1"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="filter-item">
            <label>Field Name</label>
            <Select
              value={filters.field_name}
              onChange={(e) => setFilters({ ...filters, field_name: e.target.value })}
            >
              <option value="">All Fields</option>
              {uniqueFields.map((field) => (
                <option key={field} value={field}>{field}</option>
              ))}
            </Select>
            {filters.field_name && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ ...filters, field_name: '' })}
                className="mt-1"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="filter-item">
            <label>Vendor</label>
            <Select
              value={filters.vendor}
              onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
            >
              <option value="">All Vendors</option>
              {uniqueVendors.map((vendor) => (
                <option key={vendor} value={vendor}>{vendor}</option>
              ))}
            </Select>
            {filters.vendor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ ...filters, vendor: '' })}
                className="mt-1"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="filter-item">
            <label>Apply for All</label>
            <div className="flex items-center space-x-2">
              <Switch
                id="apply-for-all-filter"
                checked={filters.apply_for_all === true}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFilters({ ...filters, apply_for_all: true })
                  } else {
                    setFilters({ ...filters, apply_for_all: null })
                  }
                }}
              />
              <Label htmlFor="apply-for-all-filter" className="text-sm cursor-pointer">
                {filters.apply_for_all === true ? 'Only "Apply for All" changes' : 'All changes'}
              </Label>
            </div>
            {filters.apply_for_all === true && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ ...filters, apply_for_all: null })}
                className="mt-1"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="log-content">
        {loading ? (
          <div className="loading flex items-center justify-center gap-2">
            <Spinner className="h-5 w-5" />
            <span>Loading changes...</span>
          </div>
        ) : changes.length === 0 ? (
          <div className="empty">No changes found</div>
        ) : (
          <ScrollArea className="h-[600px] w-full rounded-md border">
            <div className="changes-list p-4">
              {changes.map((change) => {
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
                return value
              }
              
              return (
                <div key={change.id} className="change-item">
                  <div className="change-header">
                    <div>
                      <strong>{change.field_name}</strong>
                      <span className="change-date">
                        {new Date(change.changed_at).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRevertDialog(change)}
                      className="text-destructive hover:text-destructive"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Revert
                    </Button>
                  </div>
                  <div className="change-body">
                    <p>
                      <strong>Device:</strong> {change.model || 'N/A'} ({change.vendor || 'N/A'})
                    </p>
                    <p>
                      <strong>CPS-ID:</strong> {change.device_cps_id || 'N/A'}
                    </p>
                    <p>
                      <strong>New Value:</strong> {formatValue(change.field_name, change.new_value)}
                    </p>
                    <p>
                      <strong>Editor:</strong> {change.editor_user_name || 'N/A'}
                    </p>
                    {change.apply_for_all && (
                      <p className="text-blue-600 font-medium">
                        ✓ Applied to all devices with same CPS-ID
                      </p>
                    )}
                    {change.note && (
                      <p>
                        <strong>Note:</strong> {change.note}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
            </div>
          </ScrollArea>
        )}
      </div>

      <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to revert this change? This will permanently delete the override record.
              {changeToRevert && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p><strong>Field:</strong> {changeToRevert.field_name}</p>
                  <p><strong>Device:</strong> {changeToRevert.model || 'N/A'} ({changeToRevert.vendor || 'N/A'})</p>
                  <p><strong>Changed by:</strong> {changeToRevert.editor_user_name || 'N/A'}</p>
                  <p><strong>Date:</strong> {new Date(changeToRevert.changed_at).toLocaleString()}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevertDialogOpen(false)
                setChangeToRevert(null)
              }}
              disabled={reverting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevert}
              disabled={reverting}
            >
              {reverting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Reverting...
                </>
              ) : (
                'Revert Change'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ChangesLog

