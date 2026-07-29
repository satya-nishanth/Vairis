param location string
param environmentName string
param containerAppsEnvironmentId string
param postgresConnectionString string
@secure()
param jwtSecret string
param siteUrl string
param apiExternalUrl string
param googleClientId string
@secure()
param googleClientSecret string

resource gotrue 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'gotrue-vairis-${environmentName}'
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 8081 } // GoTrue's actual default listen port — 9999 is Supabase's docker-compose *external* mapping, not the container's internal port
      secrets: [
        { name: 'db-url', value: postgresConnectionString }
        { name: 'jwt-secret', value: jwtSecret }
        { name: 'google-secret', value: googleClientSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'gotrue'
          image: 'supabase/gotrue:v2.172.0' // "latest" tag doesn't exist on this image — Supabase only publishes pinned versions
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
