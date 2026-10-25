{{/*
Every resource is named after the chart (catalog-api, postgres...), not after the
release, so the names in the cluster are the ones the services already use for
each other (the same as in docker-compose).
*/}}
{{- define "sales-lib.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
{{- end }}

{{- define "sales-lib.labels" -}}
{{ include "sales-lib.selectorLabels" . }}
app.kubernetes.io/part-of: sales
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* registry/repository:tag. The tag and registry can be set once for every service (global). */}}
{{- define "sales-lib.image" -}}
{{- $registry := .Values.global.imageRegistry | default "" -}}
{{- $tag := .Values.global.imageTag | default .Values.image.tag -}}
{{- if $registry }}{{ $registry }}/{{ end }}{{ .Values.image.repository }}:{{ $tag }}
{{- end }}

{{/* The secret that holds every password and the inner-auth secret (created by scripts/create-secrets.sh). */}}
{{- define "sales-lib.secretName" -}}
{{ .Values.global.secretName | default "sales-secrets" }}
{{- end }}

{{/* The container security settings every workload gets. */}}
{{- define "sales-lib.containerSecurity" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop: ["ALL"]
{{- end }}
