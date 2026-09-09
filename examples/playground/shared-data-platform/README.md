# Shared data platform

`head` is the Architecture scenario shown in the Playground. It models an
Azure and Google Cloud data platform with AKS, GKE, Kubernetes workloads,
private data services, Pub/Sub, Vault authentication, and Grafana data
sources.

The Diff scenario compares `base` with `head` and shows a staged migration
that:

- moves the analytics namespace, API, and service from GKE to AKS;
- redirects Vault Kubernetes authentication to the new cluster;
- replaces a stateful warehouse workload with a Cloud Run service;
- moves a Pub/Sub subscription to a replacement topic;
- replaces a logs data source with profiles.

Both projects build statically. No cloud account, credentials, provider
process, plan, or state is required.
