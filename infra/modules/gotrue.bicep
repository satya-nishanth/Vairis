param location string
param environmentName string
param containerAppsEnvironmentId string
param postgresConnectionString string
param siteUrl string
param apiExternalUrl string
param googleClientId string
param keyVaultUri string
param userAssignedIdentityId string

resource gotrue 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'gotrue-vairis-${environmentName}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${userAssignedIdentityId}': {} }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 8081 } // GoTrue's actual default listen port — 9999 is Supabase's docker-compose *external* mapping, not the container's internal port
      secrets: [
        { name: 'db-url', value: postgresConnectionString }
        { name: 'jwt-secret', keyVaultUrl: '${keyVaultUri}secrets/gotrue-jwt-secret', identity: userAssignedIdentityId }
        { name: 'google-secret', keyVaultUrl: '${keyVaultUri}secrets/google-client-secret', identity: userAssignedIdentityId }
      ]
    }
    template: {
      containers: [
        {
          name: 'gotrue'
          // v2.172.0 -> v2.180.0 (2026-09-20): v2.172.0's session-refresh path panics
          // scanning oauth.sessions.oauth_client_id when NULL ("missing destination name
          // oauth_client_id in *models.Session") — GoTrue's own migrations add that column,
          // but that version's refresh code doesn't handle it being unset. Broke POST /token
          // grant_type=refresh_token for every session sitewide. Known upstream bug, confirmed
          // fixed by this version: https://github.com/supabase/supabase/issues/39394
          image: 'supabase/gotrue:v2.180.0' // "latest" tag doesn't exist on this image — Supabase only publishes pinned versions
          env: [
            { name: 'GOTRUE_DB_DRIVER', value: 'postgres' }
            { name: 'DATABASE_URL', secretRef: 'db-url' }
            { name: 'API_EXTERNAL_URL', value: apiExternalUrl } // required — GoTrue's own public URL, used to build OAuth callback URLs. Missing from the original migration doc's Bicep; startup fails without it ("required key API_EXTERNAL_URL missing value")
            { name: 'GOTRUE_SITE_URL', value: siteUrl }
            { name: 'GOTRUE_JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'GOTRUE_JWT_EXP', value: '3600' }
            { name: 'GOTRUE_EXTERNAL_GOOGLE_ENABLED', value: 'true' }
            { name: 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID', value: googleClientId }
            { name: 'GOTRUE_EXTERNAL_GOOGLE_SECRET', secretRef: 'google-secret' }
            // GoTrue does not reliably auto-derive this from API_EXTERNAL_URL on
            // this image version — without it, /authorize 400s with "Unsupported
            // provider: missing redirect URI" before ever reaching Google. Must
            // also be added to the Google Cloud Console OAuth client's own
            // "Authorized redirect URIs" list, or Google will reject it with
            // redirect_uri_mismatch on the next hop instead.
            { name: 'GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI', value: '${apiExternalUrl}/callback' }
            { name: 'GOTRUE_MAILER_AUTOCONFIRM', value: 'false' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: environmentName == 'prod' ? 2 : 1 }
    }
  }
  tags: { env: environmentName, project: 'vairis' }
}

output gotrueUrl string = 'https://${gotrue.properties.configuration.ingress.fqdn}'
