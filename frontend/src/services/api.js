import axios from 'axios'

// In Databricks Apps, API is on the same origin as frontend
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const catalogAPI = {
  getCatalogGroups: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      if (filters.validated_only) params.append('validated_only', 'true')
      if (filters.search_term) params.append('search_term', filters.search_term)
      if (filters.vendor) params.append('vendor', filters.vendor)
      if (filters.category) params.append('category', filters.category)
      
      const response = await api.get(`/catalog/groups?${params}`)
      return response.data
    } catch (error) {
      console.error('API Error in getCatalogGroups:', error)
      console.error('Response:', error.response?.data)
      console.error('Status:', error.response?.status)
      throw error
    }
  },

  getDevice: async (deviceUuid, validatedOnly = false) => {
    const response = await api.get(`/device/${deviceUuid}`, {
      params: { validated_only: validatedOnly },
    })
    return response.data
  },

  getVariants: async (cpsId, validatedOnly = false) => {
    const response = await api.get(`/cps-id/${cpsId}/variants`, {
      params: { validated_only: validatedOnly },
    })
    return response.data
  },

  commitOverride: async (overrideData) => {
    // Ensure user info is set to signal backend to use session headers
    const payload = {
      ...overrideData,
      editor_user_id: overrideData.editor_user_id || 'current_user',
      editor_user_name: overrideData.editor_user_name || 'Current User',
      apply_for_all: overrideData.apply_for_all || false
    }
    const response = await api.post('/device/override', payload)
    return response.data
  },

  getOverrides: async (deviceUuid) => {
    const response = await api.get(`/device/${deviceUuid}/overrides`)
    return response.data
  },

  getStats: async () => {
    try {
      const response = await api.get('/stats')
      return response.data
    } catch (error) {
      console.error('API Error in getStats:', error)
      console.error('Response:', error.response?.data)
      throw error
    }
  },

  getAllChanges: async (limit = 1000) => {
    const response = await api.get('/changes', { params: { limit } })
    return response.data
  },

  getSchema: async () => {
    const response = await api.get('/schema')
    return response.data
  },

  getDeviceChangesOverTime: async (deviceUuid, days = 7) => {
    const response = await api.get(`/device/${deviceUuid}/changes-over-time`, {
      params: { days },
    })
    return response.data
  },

  deleteChange: async (changeId) => {
    const response = await api.delete(`/changes/${changeId}`)
    return response.data
  },
}

export default api

