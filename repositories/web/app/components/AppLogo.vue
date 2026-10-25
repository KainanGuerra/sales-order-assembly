<script setup lang="ts">
// The mark (same drawing as public/favicon.svg) with the name beside it. The
// name is drawn in strokes, so it needs no font and follows the text colour of
// the place it is in. `stacked` puts the name under the mark, for the login screen.
defineProps<{ size?: number; hideName?: boolean; stacked?: boolean }>();
const { t } = useI18n();
</script>

<template>
  <span class="inline-flex items-center" :class="stacked ? 'flex-col gap-4' : 'gap-2.5'" role="img" :aria-label="t('app.title')">
    <svg :width="size ?? 32" :height="size ?? 32" viewBox="0 0 512 512" aria-hidden="true" class="shrink-0 drop-shadow-sm">
      <defs>
    <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14b8a6"/>
      <stop offset="1" stop-color="#115e59"/>
    </linearGradient>
  </defs>
      <rect width="512" height="512" rx="112" fill="url(#logo-bg)"/>
  <path d="M122 258L398 132L262 304Z" fill="#fff"/>
  <path d="M262 304L398 132L318 392Z" fill="#fff" fill-opacity=".62"/>
  <path d="M88 338H178" stroke="#fbbf24" stroke-width="16" stroke-linecap="round"/>
  <path d="M88 376H214" stroke="#fff" stroke-opacity=".6" stroke-width="16" stroke-linecap="round"/>
  <path d="M88 414H150" stroke="#fff" stroke-opacity=".38" stroke-width="16" stroke-linecap="round"/>
    </svg>
    <svg v-if="!hideName" :height="stacked ? (size ?? 32) * 0.36 : (size ?? 32) * 0.78" viewBox="-8 -8 450 96" aria-hidden="true" class="shrink-0">
      <path d="M0 0V80M0 50C0 34 12 28 26 28C40 28 48 36 48 50V80" transform="translate(0 0)" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 54H46C46 38 36 28 24 28C10 28 2 40 2 54C2 68 10 80 24 80C33 80 41 76 45 70" transform="translate(70 0)" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M0 28V80M0 50C0 36 10 28 24 28" transform="translate(138 0)" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M0 28V80M0 48C0 34 10 28 22 28C34 28 42 34 42 48V80M42 48C42 34 52 28 64 28C76 28 84 34 84 48V80" transform="translate(184 0)" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 54H46C46 38 36 28 24 28C10 28 2 40 2 54C2 68 10 80 24 80C33 80 41 76 45 70" transform="translate(290 0)" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 40C38 32 30 28 22 28C10 28 4 34 4 41C4 50 14 52 24 54C36 56 42 60 42 67C42 75 34 80 22 80C12 80 4 76 0 68" transform="translate(358 0)" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="428" cy="74" r="8" fill="#f59e0b"/>
    </svg>
  </span>
</template>
