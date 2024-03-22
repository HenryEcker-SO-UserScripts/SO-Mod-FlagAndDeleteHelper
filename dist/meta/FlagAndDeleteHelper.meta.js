// ==UserScript==
// @name         SE post flag and delete helper 
// @description  Adds a "Flag and remove" button to all posts that assists in raising text flags and immediately handling them
// @homepage     https://github.com/HenryEcker-SO-UserScripts/SO-Mod-FlagAndDeleteHelper
// @author       Henry Ecker (https://github.com/HenryEcker)
// @version      0.0.19
// @downloadURL  https://github.com/HenryEcker-SO-UserScripts/SO-Mod-FlagAndDeleteHelper/raw/master/dist/FlagAndDeleteHelper.user.js
// @updateURL    https://github.com/HenryEcker-SO-UserScripts/SO-Mod-FlagAndDeleteHelper/raw/master/dist/meta/FlagAndDeleteHelper.meta.js
//
// @match        *://*askubuntu.com/questions/*
// @match        *://*mathoverflow.net/questions/*
// @match        *://*serverfault.com/questions/*
// @match        *://*stackapps.com/questions/*
// @match        *://*stackexchange.com/questions/*
// @match        *://*stackoverflow.com/questions/*
// @match        *://*superuser.com/questions/*
//
// @exclude      *://*askubuntu.com/questions/ask*
// @exclude      *://*mathoverflow.net/questions/ask*
// @exclude      *://*serverfault.com/questions/ask*
// @exclude      *://*stackapps.com/questions/ask*
// @exclude      *://*stackexchange.com/questions/ask*
// @exclude      *://*stackoverflow.com/questions/ask*
// @exclude      *://*superuser.com/questions/ask*
// @exclude      *//chat.stackoverflow.com/*  
// @exclude      *//chat.meta.stackexchange.com/*  
// @exclude      *//chat.stackexchange.com/*  
//
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
//
// ==/UserScript==
/* globals StackExchange, Stacks, $ */