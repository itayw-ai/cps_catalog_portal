import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Spinner } from './ui/spinner'
import { Plus, Trash2 } from 'lucide-react'
import { catalogAPI } from '../services/api'
import { toast } from 'sonner'

function CVETable({ deviceUuid, cpsId, currentValue, onSave }) {
  // Parse current value - expect JSON array
  const parseValue = (val) => {
    if (!val) return []
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          cve: item.cve || item.CVE || '',
          relevance: item.relevance || ''
        })).filter(item => item.cve || item.relevance)
      }
    } catch {}
    // If not JSON, try splitting by comma (legacy format)
    if (typeof val === 'string') {
      return val.split(',').map(cve => ({
        cve: cve.trim(),
        relevance: ''
      })).filter(item => item.cve)
    }
    return []
  }

  const [items, setItems] = useState(parseValue(currentValue))
  const [applyForAll, setApplyForAll] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setItems(parseValue(currentValue))
  }, [currentValue])

  const addRow = () => {
    setItems([...items, { cve: '', relevance: '' }])
  }

  const removeRow = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Format as JSON array - keep items that have either cve or relevance
      const valueToSave = JSON.stringify(items.filter(item => item.cve.trim() || item.relevance))
      
      const data = await catalogAPI.commitOverride({
        device_uuid: deviceUuid,
        field_name: 'potential_cves',
        new_value: valueToSave,
        editor_user_id: 'current_user',
        editor_user_name: 'Current User',
        apply_for_all: applyForAll
      })

      if (data.success) {
        setSuccess(true)
        toast.success(`Updated Potential CVEs${applyForAll ? ' (applied to all devices with same CPS-ID)' : ''}`)
        if (onSave) {
          onSave('potential_cves', valueToSave)
        }
      } else {
        const errorMsg = data.detail || data.error || 'Failed to save'
        setError(errorMsg)
        toast.error(`Failed to save Potential CVEs: ${errorMsg}`)
      }
    } catch (err) {
      const errorMsg = err.message || 'Network error'
      setError(errorMsg)
      toast.error(`Failed to save Potential CVEs: ${errorMsg}`)
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = JSON.stringify(items) !== JSON.stringify(parseValue(currentValue))

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Potential CVEs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">CVE ID</TableHead>
                <TableHead>Relevance</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                    No CVEs added
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={item.cve}
                        onChange={(e) => updateItem(index, 'cve', e.target.value)}
                        placeholder="CVE-2023-XXXX"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.relevance}
                        onChange={(e) => updateItem(index, 'relevance', e.target.value)}
                      >
                        <option value="">-- Select --</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Irrelevant">Irrelevant</option>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-2" />
          Add CVE
        </Button>

        {hasChanges && (
          <div className="space-y-2">
            {cpsId && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="apply-for-all-cves"
                  checked={applyForAll}
                  onChange={(e) => setApplyForAll(e.target.checked)}
                />
                <Label htmlFor="apply-for-all-cves" className="text-sm font-normal cursor-pointer">
                  Apply to all devices with CPS-ID: {cpsId}
                </Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            Error: {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
            ✓ Updated Potential CVEs
            {applyForAll && ' (applied to all devices with same CPS-ID)'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CVETable

