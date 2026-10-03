# quikdb-demo

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
