import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Spinner } from './ui/spinner'
import { Plus, Trash2 } from 'lucide-react'
import { catalogAPI } from '../services/api'
import { toast } from 'sonner'

function PatchTable({ deviceUuid, cpsId, currentValue, onSave }) {
  // Parse current value - expect JSON array
  const parseValue = (val) => {
    if (!val) return []
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          kb: item.kb || item.KB || '',
          link: item.link || item.Link || ''
        })).filter(item => item.kb || item.link)
      }
    } catch {}
    // If not JSON, try splitting by comma (legacy format)
    if (typeof val === 'string') {
      return val.split(',').map(patch => ({
        kb: patch.trim(),
        link: ''
      })).filter(item => item.kb)
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
    setItems([...items, { kb: '', link: '' }])
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
      // Format as JSON array
      const valueToSave = JSON.stringify(items.filter(item => item.kb.trim() || item.link.trim()))
      
      const data = await catalogAPI.commitOverride({
        device_uuid: deviceUuid,
        field_name: 'certified_patches',
        new_value: valueToSave,
        editor_user_id: 'current_user',
        editor_user_name: 'Current User',
        apply_for_all: applyForAll
      })

      if (data.success) {
        setSuccess(true)
        toast.success(`Updated Certified Patches${applyForAll ? ' (applied to all devices with same CPS-ID)' : ''}`)
        if (onSave) {
          onSave('certified_patches', valueToSave)
        }
      } else {
        const errorMsg = data.detail || data.error || 'Failed to save'
        setError(errorMsg)
        toast.error(`Failed to save Certified Patches: ${errorMsg}`)
      }
    } catch (err) {
      const errorMsg = err.message || 'Network error'
      setError(errorMsg)
      toast.error(`Failed to save Certified Patches: ${errorMsg}`)
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = JSON.stringify(items) !== JSON.stringify(parseValue(currentValue))

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Certified Patches</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">KB</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                    No patches added
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={item.kb}
                        onChange={(e) => updateItem(index, 'kb', e.target.value)}
                        placeholder="KB Number"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.link}
                        onChange={(e) => updateItem(index, 'link', e.target.value)}
                        placeholder="Link URL"
                      />
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
          Add Patch
        </Button>

        {hasChanges && (
          <div className="space-y-2">
            {cpsId && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="apply-for-all-patches"
                  checked={applyForAll}
                  onChange={(e) => setApplyForAll(e.target.checked)}
                />
                <Label htmlFor="apply-for-all-patches" className="text-sm font-normal cursor-pointer">
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
            ✓ Updated Certified Patches
            {applyForAll && ' (applied to all devices with same CPS-ID)'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default PatchTable

