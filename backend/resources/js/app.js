import { createApp, h } from "vue";
import { createInertiaApp } from "@inertiajs/vue3";
import "../css/original.css";
import "../css/app.css";
const pages = import.meta.glob("./Pages/*.vue");
createInertiaApp({
    resolve: (name) => pages[`./Pages/${name}.vue`](),
    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) })
            .use(plugin)
            .mount(el);
    },
    progress: { color: "#ffffff" },
});
