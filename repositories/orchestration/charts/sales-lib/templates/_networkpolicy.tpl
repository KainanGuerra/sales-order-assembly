{{/*
What this workload may receive and send. The namespace denies everything by
default (the umbrella chart); this adds only the paths the workload needs.

  networkPolicy:
    ingress:                     who may connect to it, and on which ports
      - from: [web]              other workloads of the system, by name
        ports: [3002]
      - fromNamespace: traefik   or every pod of another namespace
        ports: [3000]
    egress:                      whom it may connect to
      - to: [postgres]
        ports: [5432]

Name resolution (DNS) is always allowed out.
*/}}
{{- define "sales-lib.networkpolicy" -}}
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Chart.Name }}
  labels:
    {{- include "sales-lib.labels" . | nindent 4 }}
spec:
  podSelector:
    matchLabels:
      {{- include "sales-lib.selectorLabels" . | nindent 6 }}
  policyTypes: [Ingress, Egress]
  {{- with .Values.networkPolicy.ingress }}
  ingress:
    {{- range . }}
    - from:
        {{- range .from }}
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: {{ . }}
        {{- end }}
        {{- if .fromNamespace }}
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: {{ .fromNamespace }}
        {{- end }}
      ports:
        {{- range .ports }}
        - protocol: TCP
          port: {{ . }}
        {{- end }}
    {{- end }}
  {{- end }}
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
    {{- range .Values.networkPolicy.egress }}
    - to:
        {{- range .to }}
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: {{ . }}
        {{- end }}
      ports:
        {{- range .ports }}
        - protocol: TCP
          port: {{ . }}
        {{- end }}
    {{- end }}
{{- end }}
