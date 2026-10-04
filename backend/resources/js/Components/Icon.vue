<script setup>
defineProps({ name: String, size: { type: Number, default: 20 } });
const paths = {
    play: 'm9 5 11 7-11 7Z',
    arrow: 'M7 17 17 7M7 7h10v10',
    right: 'M4 12h16m-6-6 6 6-6 6',
    download: 'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',
    shield: 'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7Zm-4 9 3 3 5-6',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
    monitor: 'M3 3h18v14H3ZM8 21h8m-4-4v4',
    check: 'm5 12 4 4L19 6',
    lock: 'M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3m-4 4v3',
    windows: 'M3 5 10 4v7H3ZM13 3l8-1v9h-8ZM3 14h7v7l-7-1ZM13 14h8v9l-8-1Z',
    linux: 'M8 14V8a4 4 0 0 1 8 0v6l4 6H4Zm2-6h.01M14 8h.01m-4 4h4',
    sparkle: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
    film: 'M3 3h18v18H3ZM7 3v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4',
};
</script>
<template>
    <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon"><path :d="paths[name] || paths.play" /></svg>
</template>
