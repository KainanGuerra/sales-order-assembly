{{- define "sales-lib.service" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ .Chart.Name }}
  labels:
    {{- include "sales-lib.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  selector:
    {{- include "sales-lib.selectorLabels" . | nindent 4 }}
  ports:
    {{- range .Values.ports }}
    - name: {{ .name }}
      port: {{ .port }}
      targetPort: {{ .name }}
    {{- end }}
{{- end }}
