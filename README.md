# MongoDB aggregation pipeline autocomplete

## Development
Install dependencies:
```typescript
npm instal;
```

Run application locally:
```shell
npm run dev
```
mongodb-pipeline-autocomplete

## Deployment
Build production app build:
```shell
docker build -t mongodb-pipeline-autocomplete .
```

Run production app build locally:
```shell
docker run -p 8080:3000 mongodb-pipeline-autocomplete
# open locally
http://localhost:8080
```

Configure Drone CI/CD:
- [How to configure Drone (CI/CD)](https://kanopy.corp.mongodb.com/docs/getting_started/drone_configuration/)
- add GitHub repo to Drone (ci/cd) and activate Drone project
   - go to https://drone.corp.mongodb.com
  - press search, find your GitHub repo, e.g. `vm-mishchenko/poc-mongodb-pipeline-autocomplete`
  - activate project
- add secrets to the project so Drone can deploy the app
  - get access to kubernetes to fetch secrets
    - go to https://auth.staging.corp.mongodb.com
    - get config -> update `~/.kube/config`
    - update context `kubectl config set-context $(kubectl config current-context) --namespace cloud-atlas-search`
    - should be able to execute `kubectl get pods` 
  - get secret values and add them to [Drone project](https://drone.corp.mongodb.com/vm-mishchenko/poc-mongodb-pipeline-autocomplete/settings/secrets)
    - `ecr_access_key`
      - kubectl get secret ecr -o jsonpath="{.data.ecr_access_key}" | base64 --decode && echo
    - `ecr_secret_key`
      - kubectl get secret ecr -o jsonpath="{.data.ecr_secret_key}" | base64 --decode && echo
    - `staging_kubernetes_token`
      - kubectl get secret tiller-token -o jsonpath="{.data.token}" | base64 --decode && echo
- each commit will be deployed
