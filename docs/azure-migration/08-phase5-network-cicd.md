# Phase 5 — Front Door, DNS Cutover, Staging First

**Goal:** prove Front Door + WAF against staging's throwaway endpoint, then put the real custom domain and DNS cutover in front of prod. CI/CD itself (`azd pipeline config`) was already set up per-environment in Phase 0 — this phase is networking, not pipelines.
**Ships app code:** Indirectly, via the GitHub Actions workflows from Phase 0 now that there's something real to route to.
**Est. effort:** 2–3 days, plus a monitoring window after the real cutover.

## 1. The Front Door module

Use **Premium** tier, not Standard: managed WAF rule sets (the OWASP-style `Microsoft_DefaultRuleSet`) require Premium — Standard only supports hand-written custom rules. Premium also adds bot-protection, worth having in front of auth/checkout endpoints.

```bicep
// infra/modules/frontdoor.bicep
param environmentName string
param appUrl string          // Container App's FQDN, from Phase 4's output
param customDomainName string = ''   // empty for staging; set for prod in step 3 below

resource profile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: 'fd-vairis-${environmentName}'
  location: 'global'
  sku: { name: 'Premium_AzureFrontDoor' }
  tags: { env: environmentName, project: 'vairis' }
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: profile
  name: 'vairis-${environmentName}'
  location: 'global'
  properties: { enabledState: 'Enabled' }
}

resource originGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: profile
  name: 'vairis-app-origin'
  properties: {
    loadBalancingSettings: { sampleSize: 4, successfulSamplesRequired: 3 }
    healthProbeSettings: { probeRequestType: 'GET', probeProtocol: 'Https', probePath: '/api/health', probeIntervalInSeconds: 30 }
  }
}

resource origin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroup
  name: 'vairis-app-${environmentName}'
  properties: {
    hostName: appUrl
    originHostHeader: appUrl
    httpsPort: 443
  }
}

resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: endpoint
  name: 'default-route'
  properties: {
    originGroup: { id: originGroup.id }
    supportedProtocols: ['Https']
    forwardingProtocol: 'HttpsOnly'
    httpsRedirect: 'Enabled'
    patternsToMatch: ['/*']
  }
  dependsOn: [origin]
}

resource waf 'Microsoft.Network/frontdoorwebapplicationfirewallpolicies@2024-02-01' = {
  name: 'wafVairis${environmentName}'
  location: 'global'
  sku: { name: 'Premium_AzureFrontDoor' }
  properties: {
    policySettings: { mode: 'Prevention' }
    managedRules: {
      managedRuleSets: [{ ruleSetType: 'Microsoft_DefaultRuleSet', ruleSetVersion: '2.1' }]
    }
    customRules: {
      rules: [
        {
          name: 'RateLimitPublicApis'
          priority: 100
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: 100
          action: 'Block'
          matchConditions: [
            { matchVariable: 'RequestUri', operator: 'Contains', matchValue: ['/api/track-order', '/api/auth'] }
          ]
        }
      ]
    }
  }
  tags: { env: environmentName, project: 'vairis' }
}

resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2024-02-01' = {
  parent: profile
  name: 'vairis-waf-policy'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: { id: waf.id }
      associations: [{ domains: [{ id: endpoint.id }], patternsToMatch: ['/*'] }]
    }
  }
}

output frontDoorEndpointHostname string = endpoint.properties.hostName
```

(Adjust `rateLimitThreshold` once you have real traffic data — 100 req/min is a starting guess; watch Front Door's analytics for the first week in staging, then again in prod, and revise.)

Wire in:
```bicep
module frontDoor 'modules/frontdoor.bicep' = {
  name: 'frontdoor'
  scope: rg
  params: {
    environmentName: environmentName
    appUrl: replace(replace(app.outputs.appUrl, 'https://', ''), '/', '')
  }
}
output FRONT_DOOR_HOSTNAME string = frontDoor.outputs.frontDoorEndpointHostname
```

## 2. Prove it in staging first — no custom domain needed yet

```bash
azd env select staging
azd provision
azd env get-values | grep FRONT_DOOR_HOSTNAME
```

Hit the printed `*.azurefd.net` hostname directly, confirm the full site loads through it (not just the raw Container Apps URL — this proves the origin group, health probe, and routing are all correct). Burst-test the rate-limit rule against a throwaway staging endpoint (`/api/track-order`) and confirm you get a `429` past the threshold — staging is exactly where you want to find out your WAF rule syntax was wrong, not prod.

## 3. Prod: custom domain, managed TLS, DNS cutover

```bash
azd env select prod
azd env set CUSTOM_DOMAIN_NAME "<your-domain>"
```

Extend `frontdoor.bicep`'s prod path with a custom domain resource (conditionally created only when `customDomainName` is non-empty):
```bicep
resource customDomain 'Microsoft.Cdn/profiles/customDomains@2024-02-01' = if (!empty(customDomainName)) {
  parent: profile
  name: replace(customDomainName, '.', '-')
  properties: {
    hostName: customDomainName
    tlsSettings: { certificateType: 'ManagedCertificate', minimumTlsVersion: 'TLS12' }
  }
}
```

```bash
azd provision
```

Follow the DNS validation instructions Azure prints (a TXT record at your registrar) to get the managed certificate issued, then:

1. **48 hours before cutover:** lower the existing DNS record's TTL to 60–300s at your current registrar.
2. Once the custom domain shows "Approved," hit the Front Door endpoint's own `*.azurefd.net` hostname directly and confirm the full site works — last check before the real domain points at it.
3. **Cutover:** update the DNS record (CNAME, or A record if using Azure DNS with apex support) to point at the Front Door endpoint instead of Vercel.
4. Monitor Vercel's dashboard (traffic should drop toward zero) and Front Door's analytics (traffic should rise) side by side for the next few hours.
5. **Keep the Vercel project alive and un-deleted for at least 1–2 weeks** — DNS caching stragglers can keep hitting the old target for a while.

## 4. CI/CD — already done, just confirm it

`azd pipeline config` in Phase 0 already wired both `azure-dev-staging.yml` (triggers on push to `staging` branch) and `azure-dev-prod.yml` (triggers on push to `master`) to run `azd deploy` against their respective environments via federated OIDC credentials. Nothing new to build here — just confirm both are green:

```bash
git checkout -b staging 2>/dev/null || git checkout staging
git commit --allow-empty -m "test: trigger staging deploy"
git push origin staging
# watch the Actions tab — azure-dev-staging.yml should run azd deploy against staging cleanly
```

**Container Apps revisions give blue/green almost for free** on top of this: `azd deploy` creates a new revision; by default traffic shifts once healthy, but a manual traffic-split canary is available too (`az containerapp revision set-mode --mode multiple`, then `az containerapp ingress traffic set --revision-weight <old>=90 <new>=10`) if you want to ramp a risky prod deploy gradually.

### Existing crons need zero changes

The gold-rate sync and order-expiry sweep GitHub Actions workflows (LAUNCH.md §2) POST to API routes with a Bearer secret — they don't care what's hosting those routes. Once the custom domain is cut over in step 3, they keep working exactly as before, pointed at the same domain.

## Verification checklist

- [ ] Staging Front Door endpoint serves the full site, WAF rate-limit rule confirmed with a burst test
- [ ] Prod's custom domain shows a valid managed TLS cert
- [ ] DNS cutover complete, both old (Vercel) and new (Azure) endpoints monitored through the transition window
- [ ] Both `azure-dev-staging.yml` and `azure-dev-prod.yml` run green on a push to their respective branches
- [ ] Existing gold-rate and order-sweep crons still succeed against the new domain

## Rollback

**Staging:** no customer impact either way — this endpoint was never public-facing to real users.
**Prod, within 1–2 weeks post-cutover:** revert the DNS record back to Vercel's target. Vercel has been kept warm this whole time, so this is a fast, low-risk revert. Past that window, once you've moved into Phase 7's decommission, rollback gets progressively more involved — that's the intended point where "reversible" tapers off, per the overview's principles.

---

*Back to [00-overview.md](./00-overview.md) · Previous: [07-phase4-compute.md](./07-phase4-compute.md) · Next: [09-phase6-security-cost-dr.md](./09-phase6-security-cost-dr.md)*
