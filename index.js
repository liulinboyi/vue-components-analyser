const COMPONENT_HOOKS = [
    "beforeCreate",
    "created",
    "beforeMount",
    "rendered",
    "mounted"
];

const componentMetrics = {};
let isRoot = true;

function getComponentName(vm) {
    if (isRoot) {
        isRoot = false;
        return "ROOT";
    }
    const name = vm.$options.name || vm.$options._componentTag;
    if (name) {
        return name;
    }
    return vm._uid;
}

function applyHooks(vm, metric) {
    COMPONENT_HOOKS.forEach((hook, index) => {
        const handler = function() {
            const prevHook = COMPONENT_HOOKS[index - 1];
            const origin = performance.now();
            if (!metric[hook]) {
                metric[hook] = {
                    origin,
                    interval: metric[prevHook] ? origin - metric[prevHook].origin : 0
                };
            }
        };
        vm.$once(`hook:${hook}`, handler);
        const currentValue = vm.$options[hook];
        if (Array.isArray(currentValue)) {
            vm.$options[hook] = [handler, ...currentValue];
        } else if (typeof currentValue === "function") {
            vm.$options[hook] = [handler, currentValue];
        } else {
            vm.$options[hook] = [handler];
        }
    });
}

function proxyRender(vm, metric) {
    if (!vm.$options.render) return;
    vm.$options.render = new Proxy(vm.$options.render, {
        apply(...args) {
            const res = Reflect.apply(...args);
            const origin = performance.now();
            if (!metric.rendered) {
                metric.rendered = {
                    origin,
                    interval: metric.beforeMount ? origin - metric.beforeMount.origin : 0
                };
            }
            return res;
        }
    });
}

export default {
    install(Vue, { url } = {}) {
        Vue.mixin({
            beforeCreate() {
                const metric = {};
                const name = getComponentName(this);
                if (!componentMetrics[name]) {
                    componentMetrics[name] = [];
                }
                componentMetrics[name].push(metric);
                applyHooks(this, metric);
                proxyRender(this, metric);
            }
        });
        window.addEventListener("load", () => {
            if (!url) {
                console.warn("请配置上传 url");
                console.log(componentMetrics);
                return;
            }
            fetch(url, {
                method: "post",
                body: JSON.stringify({
                    performance: componentMetrics,
                    host: location.host
                })
            });
        });
    }
};
