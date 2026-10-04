<script setup>
import { computed, ref, watch } from 'vue';
const props=defineProps({site:Object});
const failed=ref(false);
const fallback=ref(false);
const src=computed(()=>fallback.value && props.site.icon ? '/images/providers/'+props.site.icon : 'https://www.google.com/s2/favicons?sz=128&domain_url='+encodeURIComponent(props.site.url));
watch(()=>props.site.url,()=>{failed.value=false;fallback.value=false;});
function iconFailed(){if(!fallback.value && props.site.icon)fallback.value=true;else failed.value=true;}
</script>
<template><span class="provider-icon"><img v-if="!failed" :src="src" alt="" loading="lazy" referrerpolicy="no-referrer" @error="iconFailed" /><span v-else>{{ site.name.slice(0,2).toUpperCase() }}</span></span></template>
