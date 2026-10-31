<script setup lang="ts">
import { brands, type Brand } from "../data/brands";

defineProps<{ brand: Brand }>();
</script>

<template>
  <svg aria-hidden="true" viewBox="0 0 24 24" class="fill-current"><path :d="brands[brand].path" /></svg>
</template>
