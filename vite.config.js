import stimulusNWFHtmlDefineObj from './src/fadh-stimulus-components/prebuildable-stimulus-components';
import {buildMatchPatterns} from './banner-build-util';
import banner from 'vite-plugin-banner';
import packageConfig from './package.json';
import beautifyPlugin from './vite-plugin-beautify-output';
import fs from 'fs';
import path from 'path';


const postButtonLabel = 'Flag and remove';
const fileNameBase = 'FlagAndDeleteHelper';

const bannerText = `// ==UserScript==
// @name         SE post flag and delete helper 
// @description  Adds a "${postButtonLabel}" button to all posts that assists in raising text flags and immediately handling them
// @homepage     ${packageConfig.repository.homepage}
// @author       Henry Ecker (https://github.com/HenryEcker)
// @version      ${packageConfig.version}
// @downloadURL  ${packageConfig.repository.dist_url}${fileNameBase}.user.js
// @updateURL    ${packageConfig.repository.dist_meta_url}${fileNameBase}.meta.js
//
${buildMatchPatterns('// @match        ', '/questions/*')}
//
${buildMatchPatterns('// @exclude      ', '/questions/ask*')}
// @exclude      *//chat.stackoverflow.com/*  
// @exclude      *//chat.meta.stackexchange.com/*  
// @exclude      *//chat.stackexchange.com/*  
//
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
//
// ==/UserScript==
/* globals StackExchange, Stacks, $ */`;

export default () => {
    return {
        plugins: [
            beautifyPlugin({
                brace_style: 'collapse,preserve-inline'
            }),
            banner(bannerText),
            {
                closeBundle() {
                    const metaDir = path.resolve(__dirname, 'dist', 'meta');
                    if (!fs.existsSync(metaDir)) {
                        fs.mkdirSync(metaDir);
                    }
                    fs.writeFileSync(
                        path.resolve(metaDir, `${fileNameBase}.meta.js`),
                        bannerText
                    );
                }
            }
        ],
        define:{
            ...stimulusNWFHtmlDefineObj,
            SUPPORTS_PLAGIARISM_FLAG_TYPE: [1],
            POST_BUTTON_LABEL: postButtonLabel
        },
        build: {
            rollupOptions: {
                input: {
                    main: `src/${fileNameBase}.user.ts`
                },
                output: {
                    format: 'iife',
                    manualChunks: undefined,
                    entryFileNames: `${fileNameBase}.user.js`
                }
            },
            minify: false,
            outDir: './dist',
            assetsDir: '',
            sourcemap: false,
            target: ['ESNext'],
            reportCompressedSize: false
        }
    };
};