import { useState, useEffect } from 'react'
import { catalogAPI } from '../services/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { Textarea } from './ui/textarea'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Card, CardContent } from './ui/card'
import { Spinner } from './ui/spinner'
import { Combobox } from './ui/combobox'
import { cn } from '../lib/utils'
import { toast } from 'sonner'

function FieldEditor({ fieldName, fieldLabel, fieldType, currentValue, metadata, deviceUuid, cpsId, onSave, nonEditableFields = [] }) {
  // Parse multiselect value - can be comma-separated string or JSON array
  const parseMultiselectValue = (val) => {
    if (!val) return []
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {}
    if (typeof val === 'string') {
      return val.split(',').map(v => v.trim()).filter(v => v)
    }
    return []
  }

  // For multiselect, store as array; for others, store as string
  const initialValue = fieldType === 'multiselect' 
    ? parseMultiselectValue(currentValue)
    : (currentValue || '')
  
  const [value, setValue] = useState(initialValue)
  const [originalValue, setOriginalValue] = useState(initialValue)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [applyForAll, setApplyForAll] = useState(false)
  const isReadOnly = nonEditableFields.includes(fieldName)

  useEffect(() => {
    const newValue = fieldType === 'multiselect'
      ? parseMultiselectValue(currentValue)
      : (currentValue || '')
    setValue(newValue)
    setOriginalValue(newValue)
    setError(null)
    setSuccess(false)
  }, [currentValue, fieldType])

  const normalizeValue = (val) => {
    if (val === null || val === undefined) return ''
    if (Array.isArray(val)) {
      // For multiselect, compare arrays
      return JSON.stringify([...val].sort())
    }
    if (typeof val === 'boolean') return String(val)
    const str = String(val).trim()
    try {
      const num = parseFloat(str)
      if (!isNaN(num) && isFinite(num)) {
        return Number.isInteger(num) ? String(Math.round(num)) : String(num)
      }
    } catch {}
    return str
  }

  // Format date/datetime values for input fields
  const formatDateValue = (val, inputType) => {
    if (!val) return ''
    if (inputType === 'date' && val.includes('T')) {
      // Convert datetime to date
      return val.split('T')[0]
    }
    if (inputType === 'datetime-local' && val && !val.includes('T')) {
      // Convert date to datetime-local
      return val + 'T00:00'
    }
    return val
  }

  const hasChanged = normalizeValue(value) !== normalizeValue(originalValue)

  const handleSave = async () => {
    if (!hasChanged) return

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // For multiselect, convert array to comma-separated string
      const valueToSave = fieldType === 'multiselect' && Array.isArray(value)
        ? value.join(', ')
        : value

      const data = await catalogAPI.commitOverride({
        device_uuid: deviceUuid,
        field_name: fieldName,
        new_value: valueToSave,
        editor_user_id: 'current_user',
        editor_user_name: 'Current User',
        apply_for_all: applyForAll
      })

      if (data.success) {
        setOriginalValue(value)
        setSuccess(true)
        toast.success(`Updated ${fieldLabel}${applyForAll ? ' (applied to all devices with same CPS-ID)' : ''}`)
        if (onSave) {
          onSave(fieldName, value)
        }
      } else {
        const errorMsg = data.detail || data.error || 'Failed to save'
        setError(errorMsg)
        toast.error(`Failed to save ${fieldLabel}: ${errorMsg}`)
      }
    } catch (err) {
      const errorMsg = err.message || 'Network error'
      setError(errorMsg)
      toast.error(`Failed to save ${fieldLabel}: ${errorMsg}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setValue(originalValue)
    setError(null)
    setSuccess(false)
    setApplyForAll(false)
  }

  const renderInput = () => {
    const commonProps = {
      value: fieldType === 'date' || fieldType === 'datetime-local' || fieldType === 'time' 
        ? formatDateValue(value, fieldType) 
        : value,
      onChange: (e) => setValue(e.target.value),
      disabled: isReadOnly || isSaving,
      className: isReadOnly ? 'bg-muted cursor-not-allowed' : ''
    }

    switch (fieldType) {
      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            rows={3}
            placeholder={fieldLabel}
          />
        )
      case 'number':
        const min = parseFloat(metadata?.min) || 0
        const max = parseFloat(metadata?.max) || 100
        const step = parseFloat(metadata?.step) || 0.1
        const numValue = parseFloat(value) || min
        
        return (
          <Input
            type="number"
            {...commonProps}
            min={min}
            max={max}
            step={step}
            value={numValue}
            onChange={(e) => setValue(e.target.value)}
          />
        )
      case 'date':
      case 'datetime-local':
      case 'time':
        return (
          <Input
            type={fieldType}
            {...commonProps}
            placeholder={fieldLabel}
          />
        )
      case 'checkbox':
        const boolValue = value === 'true' || value === true
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`field-${fieldName}`}
              checked={boolValue}
              onChange={(e) => setValue(String(e.target.checked))}
              disabled={isReadOnly || isSaving}
            />
            <Label htmlFor={`field-${fieldName}`} className="text-sm font-normal">
              {boolValue ? 'Yes' : 'No'}
            </Label>
          </div>
        )
      case 'select':
        const options = metadata?.options || []
        return (
          <Select {...commonProps}>
            <option value="">-- Select --</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        )
      case 'combobox':
        const comboboxOptions = metadata?.options || []
        return (
          <Combobox
            options={comboboxOptions}
            value={value}
            onValueChange={(newValue) => setValue(newValue)}
            placeholder="Select option..."
            searchPlaceholder="Search options..."
            disabled={isReadOnly || isSaving}
          />
        )
      case 'multiselect':
        const multiselectOptions = metadata?.options || []
        const selectedValues = Array.isArray(value) ? value : []
        const handleMultiselectChange = (optionValue, checked) => {
          if (checked) {
            setValue([...selectedValues, optionValue])
          } else {
            setValue(selectedValues.filter(v => v !== optionValue))
          }
        }
        return (
          <div className="space-y-2">
            {multiselectOptions.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox
                  id={`${fieldName}-${opt}`}
                  checked={selectedValues.includes(opt)}
                  onChange={(e) => handleMultiselectChange(opt, e.target.checked)}
                  disabled={isReadOnly || isSaving}
                />
                <Label 
                  htmlFor={`${fieldName}-${opt}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        )
      default:
        return (
          <Input
            type="text"
            {...commonProps}
            placeholder={fieldLabel}
          />
        )
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium">{fieldLabel}</Label>
          {renderInput()}
          {isReadOnly && (
            <p className="text-xs text-muted-foreground">This field cannot be edited</p>
          )}
        </div>
        
        {hasChanged && !isReadOnly && (
          <div className="space-y-2">
            {cpsId && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`apply-for-all-${fieldName}`}
                  checked={applyForAll}
                  onChange={(e) => setApplyForAll(e.target.checked)}
                />
                <Label 
                  htmlFor={`apply-for-all-${fieldName}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  Apply to all devices with CPS-ID: {cpsId}
                </Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
              >
                {isSaving ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button
                onClick={handleCancel}
                disabled={isSaving}
                variant="outline"
                size="sm"
              >
                Cancel
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
            ✓ Updated {fieldLabel}
            {applyForAll && ' (applied to all devices with same CPS-ID)'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default FieldEditor
