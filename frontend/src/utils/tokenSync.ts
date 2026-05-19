/**
 * Token Synchronization Utility
 * Syncs authentication tokens between ScholarSync and SkyFlow
 */

export const syncTokenFromScholarSync = (): boolean => {
  // Check if we already have a SkyFlow token
  const skyflowToken = localStorage.getItem('token')
  if (skyflowToken) {
    return true
  }

  // Try to get ScholarSync token
  const scholarSyncToken = localStorage.getItem('auth_token')
  if (scholarSyncToken) {
    // Copy to SkyFlow token storage
    localStorage.setItem('token', scholarSyncToken)
    console.log('✅ Token synced from ScholarSync to SkyFlow')
    return true
  }

  return false
}

export const syncTokenToScholarSync = (): boolean => {
  // Check if we already have a ScholarSync token
  const scholarSyncToken = localStorage.getItem('auth_token')
  if (scholarSyncToken) {
    return true
  }

  // Try to get SkyFlow token
  const skyflowToken = localStorage.getItem('token')
  if (skyflowToken) {
    // Copy to ScholarSync token storage
    localStorage.setItem('auth_token', skyflowToken)
    console.log('✅ Token synced from SkyFlow to ScholarSync')
    return true
  }

  return false
}

export const clearAllTokens = (): void => {
  localStorage.removeItem('token')
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user')
  localStorage.removeItem('organizations')
  localStorage.removeItem('selectedOrganization')
  console.log('🗑️ All tokens cleared')
}
