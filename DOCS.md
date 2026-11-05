# quikdb-demo

## Exactly-en/ar locale candidate — 2026-11-05

The active public reliability demo now has a complete English source catalogue, intentionally empty
Arabic review catalogue, browser-first detection, visible switcher, document-level RTL, logical
switcher positioning and localized dynamic status/feed copy. Arabic remains server-disabled until
named human review; product names and technical node identifiers remain unchanged.

PR qualification separately exercises the production Arabic gate and the CI-only review switcher,
including keyboard focus, EN-to-AR and AR-to-EN interaction, persisted reload, English fallback,
RTL boundaries and desktop/mobile screenshots.

Single-page public reliability demo at `demo.quikdb.com`.

## HubSpot tracking

The root layout loads HubSpot portal `149469290` after the page becomes interactive. The site has
no authenticated or private routes.

## Production deployment

Production runs as the single-replica `demo-web-prod` workload in the shared QuikDB EKS cluster.
The deployment, service, image build and release workflow are owned by
`quikdb-infra/applications/demo/`. `demo.quikdb.com` is routed through the shared QuikDB ALB and
wildcard certificate. Keep one replica because the interactive simulation stores its state in the
server process.
