param location string
param environmentName string
param containerAppsEnvironmentId string
param postgresConnectionString string
param siteUrl string
param apiExternalUrl string
param googleClientId string
param keyVaultUri string
param userAssignedIdentityId string

// Separate Resend sending domain per environment — each env's Key Vault already holds its
// own resend-api-key secret, this keeps the "From" address isolated the same way.
var smtpAdminEmail = environmentName == 'prod' ? 'noreply@thevairis.com' : 'noreply@stage.thevairis.com'

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
        // Same Resend API key the app itself uses (lib/email.ts) — Resend's SMTP endpoint
        // accepts the API key as the SMTP password with literal username "resend".
        { name: 'resend-api-key', keyVaultUrl: '${keyVaultUri}secrets/resend-api-key', identity: userAssignedIdentityId }
      ]
    }
    template: {
      containers: [
        {
          name: 'gotrue'
          // v2.172.0 -> v2.180.0 (2026-09-20) fixed missing oauth_client_id in
          // models.Session, but v2.180.0 was itself missing refresh_token_hmac_key /
          // refresh_token_counter (added v2.181.0) and scopes (added v2.183.0) — same
          // "GoTrue's own migration adds a sessions column its own Session struct
          // doesn't declare yet" bug, recurring release-to-release as the OAuth 2.1
          // server feature landed in stages. Verified directly against each tagged
          // commit's internal/models/sessions.go that v2.197.0 (current latest stable)
          // has all four fields — this is not another guess, checked every field.
          image: 'supabase/gotrue:v2.197.0' // "latest" tag doesn't exist on this image — Supabase only publishes pinned versions
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
            // Without SMTP config GoTrue falls back to a Noop mail client — signup/recovery
            // emails are "sent" (200 OK, audit log entry) but never actually go out. Deliberately
            // NOT setting GOTRUE_MAILER_TEMPLATES_CONFIRMATION here — a custom template URL must
            // be fetched live from the app on every send, so it can only be wired once the
            // branded /email-templates/confirmation route is deployed in the same release train.
            { name: 'GOTRUE_SMTP_HOST', value: 'smtp.resend.com' }
            { name: 'GOTRUE_SMTP_PORT', value: '465' }
            { name: 'GOTRUE_SMTP_USER', value: 'resend' }
            { name: 'GOTRUE_SMTP_PASS', secretRef: 'resend-api-key' }
            { name: 'GOTRUE_SMTP_ADMIN_EMAIL', value: smtpAdminEmail }
            { name: 'GOTRUE_SMTP_SENDER_NAME', value: 'VAIRIS' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: environmentName == 'prod' ? 2 : 1 }
    }
  }
  tags: { env: environmentName, project: 'vairis' }
}

output gotrueUrl string = 'https://${gotrue.properties.configuration.ingress.fqdn}'
