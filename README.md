# maya

```sh
oc create serviceaccount chak -n ci
oc adm policy add-cluster-role-to-user cluster-admin system:serviceaccount:ci:chak
oc sa get-token chak -n ci
```
