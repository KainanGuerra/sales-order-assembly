{{/*
A stateless service: one container from the service's image, the same Pod shape
for all of them. What changes from one service to another is in its values.yaml.
*/}}
{{- define "sales-lib.deployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Chart.Name }}
  labels:
    {{- include "sales-lib.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "sales-lib.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "sales-lib.labels" . | nindent 8 }}
    spec:
      # The images run as the "node" user (uid 1000); the cluster refuses to run them as root.
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      {{- with .Values.waitFor }}
      # Waits until what the service needs answers, instead of starting and crashing.
      initContainers:
        - name: wait-for-dependencies
          image: busybox:1.37
          command:
            - sh
            - -c
            - |
              for target in "$@"; do
                until nc -z -w 2 "${target%:*}" "${target#*:}"; do echo "waiting for $target"; sleep 2; done
              done
          args:
            {{- toYaml . | nindent 12 }}
          securityContext:
            {{- include "sales-lib.containerSecurity" $ | nindent 12 }}
      {{- end }}
      containers:
        - name: app
          image: {{ include "sales-lib.image" . }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            {{- range .Values.ports }}
            - name: {{ .name }}
              containerPort: {{ .port }}
            {{- end }}
          # Secrets first: a later value can refer to one with $(NAME).
          env:
            {{- range .Values.secretEnv }}
            - name: {{ .name }}
              valueFrom:
                secretKeyRef:
                  name: {{ include "sales-lib.secretName" $ }}
                  key: {{ .key }}
            {{- end }}
            {{- range $name, $value := .Values.env }}
            - name: {{ $name }}
              value: {{ $value | quote }}
            {{- end }}
          startupProbe:
            httpGet:
              path: {{ .Values.probePath }}
              port: http
            periodSeconds: 3
            failureThreshold: 40
          readinessProbe:
            httpGet:
              path: {{ .Values.probePath }}
              port: http
            periodSeconds: 10
            timeoutSeconds: 3
          livenessProbe:
            httpGet:
              path: {{ .Values.probePath }}
              port: http
            periodSeconds: 20
            timeoutSeconds: 3
            failureThreshold: 3
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          securityContext:
            {{- include "sales-lib.containerSecurity" . | nindent 12 }}
          volumeMounts:
            # The root filesystem is read-only; temporary files go here.
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
{{- end }}
