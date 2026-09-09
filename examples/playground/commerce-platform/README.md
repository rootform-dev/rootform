# Commerce platform

`head` is the Architecture scenario shown in the Playground. It models a
production and staging commerce platform across Azure network, data, edge,
AKS, Kubernetes, identity, secrets, messaging, and observability resources.

The Diff scenario compares `base` with `head` and shows one release that:

- adds a recommendations deployment and service;
- moves the production analytics cluster to the edge subnet;
- replaces the staging archive endpoint and storage identity.

Both projects build statically. No Azure account, credentials, provider
process, plan, or state is required.
