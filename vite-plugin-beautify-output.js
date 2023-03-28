import {js_beautify} from 'js-beautify';


export default function beautifyPlugin(opts = {}) {
    async function beautify(code) {
        return js_beautify(code, opts);
    }

    return {
        name: 'vite-plugin-javascript-beautifier',
        enforce: 'post',
        renderChunk: {
            order: 'post',
            handler(code) {
                return beautify(code);
            }
        }
    };
}