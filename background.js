// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/*
This extension looks up HP parts and attempts to find typical solutions to user problems
AIO/Laptop:  lookup model, parts list and disassembly help
Desktop:  Lookup model and parts
Printer: Lookup model, how to reset and help on network connection
Part : lookup on eBay
Cloud: brings up the cloud recovery page but for now you need to use "copy" to get the text onto the clipboard
June 2024 its seems that //partsurfer.hp.com/partsurfer needs to be //partsurfer.hp.com
July 2024 want to extract ID and model if user listed "15-xxxx (yyyyyyy)"
there are 7 of the Y and must be 2 numeric digits minimum length of 16 characters
July 2026 "My HP 17t-CN300CTO2" failed parsing as lookup provide 100+ product IDs
reference this post https://h30434.www3.hp.com/t5/Volunteer-Lounge/My-HP-17t-CN300CTO2-laptop-will-not-power-up/m-p/9686576/highlight/false#M1366
note that the product ID for the 17t-CN300 can be
77L21AV - 17-c3000 RCTO
or
7P3Q0AV - 17-c3000 IDS Base Model
Joseph Stateson
Princal Analyst, Retired
Southwest Research Institute

Notes on Khoros:
searching explained: https://khoros-classic.kayako.com/article/124739-search-api-overview


*/

//import './marked.umd.min.js'; 
import { tldLocales } from './locales.js'; //note: locales here is NOT country or language code it should have been "options"
const hpLocale = "us-en";   // could change to in-en for india
const VirtualAgentUrl = "https://virtualagent.hpcloud.hp.com/"
//const CloudRecoveryUrl = "http://support.hp.cloud-recovery.s3-website-us-west-1.amazonaws.com/"
const CloudRecoveryUrl = "https://d34z73bbtpzgej.cloudfront.net/"
let supportGPTActive = false;

// Add a listener to create the initial context menu items,
// context menu items only need to be created at runtime.onInstalled
chrome.runtime.onInstalled.addListener(async () => {

    chrome.contextMenus.create({
        id: "FixS",
        title: "Fix Khoros Spoilers",
        type: "normal",
        contexts: ["all"]
    });
    chrome.contextMenus.create({
        id: "CitRem",
        title: "Clean Pasted HTML",
        type: "normal",
        contexts: ["all"]
    });
    chrome.contextMenus.create({
        id: "PutInSpoiler",
        title: "Put selected text into Spoiler",
        type: "normal",
        contexts: ["all"]
    });
        chrome.contextMenus.create({
        id: "CopyKhorosHtml",
        title: "Copy Khoros to Clipboard",
        type: "normal",
        contexts: ["all"]
        });
    chrome.contextMenus.create({
        id: "separator3",
        type: "separator",
        contexts: ["all"]
    });
    chrome.contextMenus.create({
        id: "FindMyAnswers",
        title: "Find all my answers",
        type: "normal",
        contexts: ['selection']
    });
    chrome.contextMenus.create({
        id: "FindThisPhrase",
        title: "Find This Phrase",
        type: "normal",
        contexts: ['selection']
    });
    chrome.contextMenus.create({
        id: "separator0",
        type: "separator",
        contexts: ["all"]
    });

    chrome.contextMenus.create({
        id: "StartSupportGPT",
        title: "Start Support GPT",
        type: "normal",
        contexts: ["all"]
    });
    chrome.contextMenus.create({
        id: "AskSupportGPT",
        title: "Ask Support GPT",
        type: "normal",
        contexts: ["all"]
    });
    chrome.contextMenus.create({
        id: "StopSupportGPT",
        title: "Stop Support GPT",
        type: "normal",
        contexts: ["all"]
    });
    chrome.contextMenus.create({
        id: "separator1",
        type: "separator",
        contexts: ["all"]
    });
    chrome.contextMenus.create({
        id: "CR",
        title: "CloudRecover",
        type: "normal",
        contexts: ['selection']
    });
    for (const [tld, locale] of Object.entries(tldLocales)) {              

        if (tld == "APrt") {
            chrome.contextMenus.create({
                id: "separator2",
                type: "separator",
                contexts: ["all"]
            });
        }

        chrome.contextMenus.create({
            id: tld,
            title: locale,
            type: 'normal',
            contexts: ['selection']
        });
    }
});

const hpCountryTable = [
    ["#A2M", "Iceland", "Iceland"],
    ["#A2N", "Saudi Arabia", "Saudi Arabia"],
    ["#A2Q", "Ukraine", "Ukraine"],
    ["#AB0", "Taiwan", "Taiwan"],
    ["#AB1", "Korea", "Korea"],
    ["#AB2", "China", "China"],
    ["#AB4", "Singapore", "Singapore"],
    ["#AB4", "Malaysia", "Malaysia"],
    ["#AB5", "Hong Kong", "Hong Kong"],
    ["#ABV", "Arabia", "Arabia (English)"],
    ["#AB6", "Arabia", "Arabia (French)"],
    ["#AB7", "Greece", "Greece"],
    ["#AB8", "Turkey", "Turkey"],
    ["#AB9", "Portugal", "Portugal"],
    ["#ABA", "United States", "US"],
    ["#ABB", "Europe", "Europe"],
    ["#ABL", "Canada", "Canada (English)"],
    ["#ABC", "Canada", "Canada (French)"],
    ["#ABD", "Germany", "Germany"],
    ["#ABE", "Spain", "Spain"],
    ["#ABF", "France", "France"],
    ["#ABG", "Australia", "Australia"],
    ["#ABH", "Netherlands", "Netherlands"],
    ["#ABJ", "Japan", "Japan"],
    ["#ABM", "L A", "L A (Spanish)"],
    ["#B16", "LA", "LA (Spanish)"],
    ["#ABN", "Norway", "Norway"],
    ["#ABS", "Sweden", "Sweden (Swedish)"],
    ["#ACY", "Sweden", "Sweden (English)"],
    ["#AK8", "Sweden", "Sweden (Finnish)"],
    ["#ABT", "Hebrew", "Hebrew"],
    ["#ABU", "UK", "UK (English)"],
    ["#ABV", "Arabia", "Arabia (English)"],
    ["#UUG", "Belgium", "Belgium (French)"],
    ["#ABW", "Belgium", "Belgium (Flemish)"],
    ["#ABX", "Finland", "Finland"],
    ["#ABY", "Denmark", "Denmark"],
    ["#ABZ", "Italy", "Italy"],
    ["#AC4", "Brazil", "Brazil"],
    ["#AC8", "Argentina", "Argentina (Spanish)"],
    ["#ACB", "Russia", "Russia"],
    ["#ACJ", "India", "India"],
    ["#ACQ", "South Africa", "South Africa"],
    ["#AH3", "Palestine", "Palestine (English)"],
    ["#AKB", "Czech", "Czech"],
    ["#AKC", "Hungary", "Hungary"],
    ["#AKD", "Poland", "Poland"],
    ["#AKE", "Romania", "Romania Romanian"],
    ["#AKG", "Eastern Europe", "Eastern Europe"],
    ["#AKJ", "Hebrew", "Hebrew (English)"],
    ["#AKL", "Thailand", "Thailand"],
    ["#AKN", "Slovenia", "Slovenia"],
    ["#AKQ", "Serbia", "Serbia Serbian"],
    ["#AKR", "Slovakia", "Slovakia"],
    ["#AKS", "Bulgaria", "Bulgaria English"],
    ["#AKV", "South America", "South America (Spanish)"],
    ["#AR6", "Indonesia", "Indonesia (English)"],
    ["#ARE", "Malaysia", "Malaysia English"],
    ["#ARL", "Baltic", "Baltic"],
    ["#BH4", "Africa", "Africa (English)"],
    ["#B10", "Africa", "Africa (Portuguese)"],
    ["#B1R", "Baltics", "Baltics Estonia"],
    ["#B1R", "Estonia", "Estonia"],
    ["#BCM", "Ukraine", "Ukraine"],
    ["#BED", "Adriatics", "Adriatics"],
    ["#BH5", "kenya", "kenya"],
    ["#BJA", "Kazakhstan", "Kazakhstan (Russian)"],
    ["#UUF", "Asia Pacific", "Asia Pacific (English)"],
    ["#UUW", "Skandinavien", "Skandinavien"],
    ["#UUZ", "Switzerland", "Switzerland"],
    ["#ABP", "Switzerland", "Swiss (German)"],
    ["#ABQ", "Switzerland", "Swiss (French)"]
];

function findHpCountry(country) {
    const matches = hpCountryTable.filter(
        entry =>
            entry[1].trim().toLowerCase() ===
            country.trim().toLowerCase()
    );

    if (matches.length === 0) {
        console.log(
            "HP country not in table:",
            country
        );

        return { // was null;
            lookupCode: "#ABA",
            matches: [ ["#ABA", "United States", "US"] ]
        }
    }

    return {
        lookupCode: matches[0][0],
        matches: matches
    };
}

function GetHpLocation() {
    const locationElement =
        document.querySelector(".user-location-wrap span");

    if (!locationElement)
        return null;

    return {
        country: locationElement.textContent.trim(),
        iso: locationElement.getAttribute("title")
    };
}

function ShowHpLanguages(country, matches) {

    // Remove an existing panel
    document.getElementById("hp-language-panel")?.remove();

    const panel = document.createElement("div");

    panel.id = "hp-language-panel";

    panel.style.position = "fixed";
    panel.style.top = "20px";
    panel.style.right = "20px";
    panel.style.zIndex = "2147483647";
    panel.style.background = "white";
    panel.style.border = "2px solid black";
    panel.style.padding = "12px";
    panel.style.fontFamily = "Arial, sans-serif";
    panel.style.fontSize = "14px";
    panel.style.boxShadow = "0 2px 10px rgba(0,0,0,.3)";

    let html =
        "<b>HP Location: " + country + "</b><br><br>";

    matches.forEach((entry, index) => {

        const code = entry[0];
        const description = entry[2];

        if (index === 0) {
            html +=
                "<b>PRIMARY:</b> " +
                code + " - " +
                description +
                "<br>";
        }
        else {
            html +=
                code + " - " +
                description +
                "<br>";
        }
    });

    html +=
        "<br><button id='hp-language-close'>Close</button>";

    panel.innerHTML = html;

    document.body.appendChild(panel);

    document
        .getElementById("hp-language-close")
        .addEventListener("click", () => {
            panel.remove();
        });
}


function GetKhorosUserId() {
    const html = document.documentElement.innerHTML;

    const match = html.match(
        /"User"\s*:\s*\{[\s\S]*?"id"\s*:\s*(\d+)/
    );

    if (!match)
        return null;

    return match[1];
}


function BuildKhorosApiSearch(searchText) {
    const query =
        "SELECT id, view_href, author, subject, body, conversation " +
        "FROM messages " +
        "WHERE depth = 0 " +
        "AND body MATCHES '" + searchText + "' " +
        "LIMIT 20";

    return "https://h30434.www3.hp.com/api/2.0/search?q=" +
        encodeURIComponent(query);
}

async function SearchKhorosApi(searchText) {

    const query =
        "SELECT id, view_href, author, subject, body, conversation " +
        "FROM messages " +
        "WHERE depth = 0 " +
        "AND body MATCHES '" + searchText + "' " +
        "LIMIT 20";

    const url =
        "https://h30434.www3.hp.com/api/2.0/search?q=" +
        encodeURIComponent(query);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Khoros API error: ${response.status}`);
    }

    const result = await response.json();

    return result?.data?.items ?? [];
}

async function GetMyReplies(topicId, userId) {

    const query =
        "SELECT id, view_href, subject, author " +
        "FROM messages " +
        "WHERE topic.id = '" + topicId + "' " +
        "AND author.id = '" + userId + "'";

    const url =
        "https://h30434.www3.hp.com/api/2.0/search?q=" +
        encodeURIComponent(query);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Khoros API error: ${response.status}`);
    }

    const result = await response.json();

    return result?.data?.items ?? [];
}

async function FindMyRepliesToPhrase(searchText, userId) {

    const topics = await SearchKhorosApi(searchText);
    const results = [];

    for (const topic of topics) {

        const replies = await GetMyReplies(topic.id, userId);

        for (const reply of replies) {
            results.push({
                topicId: topic.id,
                topicSubject: topic.subject,
                topicAuthor: topic.author.login,
                message: reply
            });
        }
    }

    return results;
}



// searchType: 1 = find these words
//             2 = find this exact phrase
function BuildKhorosAuthorSearch(searchText, userId, searchType, rangeTime) {

    let url =
        "https://h30434.www3.hp.com/t5/forums/searchpage/tab/message";

    // The filter must come before q or phrase
    if (rangeTime) {
        url += "?filter=authorId,includeForums,dateRangeType";
    }
    else {
        url += "?filter=authorId,includeForums";
    }


    if (searchType === 1) {
        // Find these words
        const encodedSearch = encodeURIComponent(searchText).replace(/%20/g, "+");

        url += "&q=" + encodedSearch;
    }
    if (searchType === 2) {
        // Find this exact phrase
        url += "&phrase=" + encodeURIComponent(searchText);
    }

    url +=
        "&author_id=" + encodeURIComponent(userId) +
        "&include_forums=true";

    if (rangeTime) {
        url += "&rangeTime=" + encodeURIComponent(rangeTime);
    }

    return url;
}

const KhorosSearchRange = {
    ALL: null,
    DAY: "24h",
    WEEK: "1w",
    MONTH: "1M",
    YEAR: "1y"
};



async function GetAppTab() {
    const urlToFind = VirtualAgentUrl;

    console.log("HP_Search: GetAppTab entered1");

    const tabs = await chrome.tabs.query({});

    const existingTab = tabs.find(tab =>
        tab.url && tab.url.startsWith(urlToFind)
    );

    if (existingTab) {
        console.log("HP_Search:SupportGPT old tab ID:", existingTab.id);
        return existingTab;
    }

    console.log("GetAppTab entered2");

    const tab = await chrome.tabs.create({
        url: urlToFind
    });

    console.log("HP_Search: SupportGPT new tab ID:", tab.id);

    return tab;
}

async function xWaitForSupportGPTButton(tabId) {
    console.log("HP_Search: Waiting for SupportGPT button in tab", tabId);

    const response = await chrome.tabs.sendMessage(tabId, {
        action: "startSupportGPT"
    });

    console.log("HP_Search response:", response);

    if (response?.success) {
        console.log("SupportGPT started");
    }
    else {
        console.log("SupportGPT could not be started");
    }
}


async function WaitForSupportGPTButton(tabId) {
    const startTime = Date.now();
    const timeout = 5000;

    while (Date.now() - startTime < timeout) {
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    const btn = [...document.querySelectorAll("button")]
                        .find(b => b.innerText.trim() ===
                            "Chat with HP's SupportGPT for AI Answers");

                    if (btn) {
                        btn.click();
                        return true;
                    }

                    return false;
                }
            });

            if (result[0]?.result === true) {
                console.log("HP_Search: SupportGPT button clicked");
                return true;
            }
        }
        catch (e) {
            // tab may have closed or page not ready
            console.log("HP_Search: injection failed", e.message);
            return false;
        }

        await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log("HP_Search: SupportGPT button timeout");
    return false;
}

async function GetSupportGPTTabs() {

    const urlToFind = VirtualAgentUrl

    const tabs = await chrome.tabs.query({});

    return tabs.filter(tab =>
        tab.url &&
        tab.url.startsWith(urlToFind)
    );
}

async function StartSupportGPT() {

    const saved = await chrome.storage.local.get("supportGPTTabId");

    if (saved.supportGPTTabId) {
        try {
            await chrome.tabs.remove(saved.supportGPTTabId);
        }
        catch {
            // Tab was already closed
        }
    }    

    const tabs = await GetSupportGPTTabs();

    await Promise.all(
        tabs.map(tab => chrome.tabs.remove(tab.id))
    );

    const newTab = await chrome.tabs.create({
        url: VirtualAgentUrl,
        active: false
    });

    console.log("HP_Search: Created new SupportGPT tab:", newTab.id);

    await chrome.storage.local.set({
        supportGPTTabId: newTab.id
    });

    supportGPTActive = true;

    // Wait for the page to load...
}



chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (!supportGPTActive) return;
    const saved = await chrome.storage.local.get("supportGPTTabId");
    const hpTabId = saved.supportGPTTabId;

    if (message.type === "HP_ANSWER") {

        console.log("HP_Search: Received HP answer:");
        //console.log(message.activity);
        RunSupportGPT(message.activity);
    }

    if (message.action === "contentReady") {
        console.log("HP_Search: content ready in tab", sender.tab.id);
        await xWaitForSupportGPTButton(sender.tab.id);
    }

    if (message.type === "GET_HP_ACTIVITY") {
        console.log("HP_Search: getting last activity");
        sendResponse({
            activity: lastActivity
        });
    }

    if (message.type === "SUPPORTGPT_HTML") {

        const saved = await chrome.storage.local.get("hpForumTabId");
        const hpTabId = saved.hpForumTabId;
        console.log("HP_Search: SupportGPT HTML processed Forum ID ", hpTabId);
        const html = message.html;

        await chrome.scripting.executeScript({
            target: { tabId: hpTabId },
            files: ["content.js"]
        });

        /*
        chrome.tabs.sendMessage(hpTabId, {
            type: "COPY_SUPPORTGPT_HTML",
            html: html
        });
        */
    }

    if (message.type === "CLICK_SUPPORTGPT") {

        const btn = [...document.querySelectorAll("button")]
            .find(b => b.innerText.trim() ===
                "Chat with HP's SupportGPT for AI Answers");

        if (btn) {
            console.log("HP_Search: BK clicking SupportGPT");
            btn.click();
        }
        else {
            console.log("HP_Search: SupportGPT button not found");
        }
    }

});


function GetSupportAgent() {
    const url9 = new URL(VirtualAgentUrl);
    const tab = chrome.tabs.create({
        url: url9.href
    });
    console.log("HP_Search: SupportGPT tab ID:", tab.id);
    return tab;
}

let lastActivity = null;
function RunSupportGPT(activity) {

    lastActivity = activity;
    const url9 = chrome.runtime.getURL("supportgpt.html");
    chrome.tabs.create({
        url: url9
    });

}

function PutSelectedIntoSpoiler() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        return;
    }

    const range = selection.getRangeAt(0);

    if (range.collapsed) {
        return;
    }

    // Save the selected HTML
    const fragment = range.cloneContents();

    // Create the spoiler
    const spoiler = document.createElement("div");
    spoiler.className = "lia-spoiler-container-editor";
    spoiler.appendChild(fragment);

    // Replace the selection with the spoiler
    range.deleteContents();
    range.insertNode(spoiler);

    // ---------------------------------------------------------
    // Put a paragraph immediately after the spoiler
    // ---------------------------------------------------------
    const paragraph = document.createElement("p");
    paragraph.innerHTML = "<br>";

    spoiler.parentNode.insertBefore(
        paragraph,
        spoiler.nextSibling
    );

    // ---------------------------------------------------------
    // Put the cursor into the paragraph
    // ---------------------------------------------------------
    const newRange = document.createRange();

    newRange.setStart(paragraph, 0);
    newRange.collapse(true);

    selection.removeAllRanges();
    selection.addRange(newRange);

    // ---------------------------------------------------------
    // Tell TinyMCE/Khoros that the editor changed
    // ---------------------------------------------------------
    const editorBody = document.body;

    if (editorBody.id === "tinymce") {
        editorBody.dispatchEvent(
            new InputEvent("input", { bubbles: true })
        );

        editorBody.dispatchEvent(
            new Event("change", { bubbles: true })
        );
    }
}

function CleanPastedHtml() { // designed for Google Docs to Khoros copy/paste but should work for other sources as well

    function ExtractFootnotes(html) {

        const temp = document.createElement("div");
        temp.innerHTML = html;

        const citationUrls = [];

        const allowedDomains = [
            "microsoft.com",
            "hp.com",
            "youtube.com",
            "wikipedia.org",
            "intel.com",
            "amd.com",
            "nvidia.com"
        ];

        // ---------------------------------------------------------
        // Find numbered footnotes working backwards
        // ---------------------------------------------------------

        const elements = [...temp.querySelectorAll("div")];

        let footnoteDivs = [];
        let expectedNumber = null;

        for (let i = elements.length - 1; i >= 0; i--) {

            const div = elements[i];
            const text = div.textContent.trim();

            const match = text.match(/^\[(\d+)\]/);

            if (!match) {

                if (footnoteDivs.length > 0)
                    break;

                continue;
            }

            const number = parseInt(match[1], 10);

            if (expectedNumber === null)
                expectedNumber = number;

            if (number !== expectedNumber)
                break;

            if (!div.querySelector("a[href]"))
                break;

            footnoteDivs.unshift(div);
            expectedNumber--;
        }

        // ---------------------------------------------------------
        // Extract allowed URLs and remove footnotes
        // ---------------------------------------------------------

        footnoteDivs.forEach(div => {

            div.querySelectorAll("a[href]").forEach(a => {

                const href = a.getAttribute("href");

                if (!href)
                    return;

                const hostname = new URL(href).hostname.toLowerCase();

                if (allowedDomains.some(domain =>
                    hostname === domain ||
                    hostname.endsWith("." + domain)
                )) {

                    // Remove Google's text-fragment portion
                    const cleanUrl = href.split("#:~:text=")[0];

                    if (!citationUrls.includes(cleanUrl))
                        citationUrls.push(cleanUrl);
                }
            });

            div.remove();
        });

        // ---------------------------------------------------------
        // Build citation spoiler
        // ---------------------------------------------------------

        let citationHtml = "";

        if (citationUrls.length > 0) {

            citationHtml =
                "<div class='lia-spoiler-container-editor'>" +
                "<b>Do not call any phone numbers listed on any website or video below, unless it is an official HP site</b><br><br>" +
                citationUrls.map(url =>
                    `<a href="${url}" target="_blank" rel="noopener">${url}</a>`
                ).join("<br><br>") +
                "</div>";
        }

        return {
            html: temp.innerHTML,
            citationHtml: citationHtml
        };
    }


    if (document.body.id !== "tinymce")
        return;

    const body = document.body;

    // ---------------------------------------------------------
    // 1. Remove Google citation spans containing only numbers
    // ---------------------------------------------------------
    body.querySelectorAll("span").forEach(span => {

        const links = span.querySelectorAll("a");

        if (links.length > 0 &&
            [...links].every(a => /^\d+$/.test(a.textContent.trim()))) {
            span.remove();
        }
    });

    let html = body.innerHTML;
     

    // Extract Google footnotes before other cleanup destroys their structure
    const result = ExtractFootnotes(html);

    html = result.html;
    const citationHtml = result.citationHtml;
   

    // ---------------------------------------------------------
    // 2. Remove citations already converted by Khoros
    // ---------------------------------------------------------
    html = html.replace(
        /\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g,
        ""
    );

    // ---------------------------------------------------------
    // 3. Remove HTML comments
    // ---------------------------------------------------------
    html = html.replace(
        /<!--[\s\S]*?-->/g,
        ""
    );

    // ---------------------------------------------------------
    // 4. Fix <strong>...</b> produced by Google
    // ---------------------------------------------------------
    html = html.replace(
        /(<strong\b[^>]*>.*?)(<\/b>)/gis,
        "$1</strong>"
    );

    // ---------------------------------------------------------
    // 5. Remove Google wrapper elements but keep contents
    // ---------------------------------------------------------
    html = html.replace(
        /<div\b[^>]*>/gi,
        ""
    );

    html = html.replace(
        /<\/div>/gi,
        "<br>"
    );

    html = html.replace(
        /<\/?(?:span|mark)\b[^>]*>/gi,
        ""
    );

    // ---------------------------------------------------------
    // 6. Remove Google's attributes from useful tags
    // ---------------------------------------------------------
    html = html.replace(
        /<ul\b[^>]*>/gi,
        "<ul>"
    );

    html = html.replace(
        /<ol\b[^>]*>/gi,
        "<ol>"
    );

    html = html.replace(
        /<li\b[^>]*>/gi,
        "<li>"
    );

    html = html.replace(
        /<strong\b[^>]*>/gi,
        "<strong>"
    );

    html = html.replace(
        /<h2\b[^>]*>/gi,
        "<h2>"
    );

    // ---------------------------------------------------------
    // 7. Remove <code> tags but keep their contents
    // ---------------------------------------------------------
    html = html.replace(
        /<\/?code\b[^>]*>/gi,
        ""
    );

    // ---------------------------------------------------------
    // 8. Remove Khoros-incompatible data-sfc-root attributes
    // ---------------------------------------------------------
    html = html.replace(/<em\b[^>]*>/gi, "<em>");

    html += citationHtml;

    body.innerHTML = html;

    // switch to DOM manipulation for the rest of the cleanup
    body.querySelectorAll("a").forEach(a => {

        const href = a.getAttribute("href");
        if (!href) return;

        // Remove every attribute
        [...a.attributes].forEach(attr => a.removeAttribute(attr.name));

        // Add back only what you want
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
    });

    // ---------------------------------------------------------
    // Remove empty bullet/list items
    // ---------------------------------------------------------
    body.querySelectorAll("li").forEach(li => {

        // Remove whitespace, including &nbsp;
        if (li.textContent.replace(/\u00a0/g, "").trim() === "") {
            li.remove();
        }
    });

    // Remove lists that are now empty
    body.querySelectorAll("ul, ol").forEach(list => {

        if (list.querySelectorAll(":scope > li").length === 0) {
            list.remove();
        }
    });


    // Tell TinyMCE/Khoros that the content has changed
    body.dispatchEvent(
        new InputEvent("input", { bubbles: true })
    );

    body.dispatchEvent(
        new Event("change", { bubbles: true })
    );
}

function FixSpoilers() {

    /*
    alert("FixSpoilers is running!");
    alert(document.location.href);
    alert(document.body.id);    
    //alerts work here because it it is running in the context of the page, not the background script
    };
    */
    if (document.body.id !== "tinymce")
        return;

    let html = document.body.innerHTML;

    let fixed = html.replaceAll(
        '<div class="">',
        '<div class="lia-spoiler-container-editor">'
    );

    if (fixed !== html) {
        document.body.innerHTML = fixed;
        document.body.dispatchEvent(
            new InputEvent("input", { bubbles: true })
        );
    }
}

function isNumber(value)
{
        if (isNaN(value)) {
            return false;
        }
    return true;
}

//14 bd0000 becomes 14-bd0000 for example
//14m db
//0123456
//14 db
function FixSpace(str)
{
    var n = str.indexOf(' ');
    if (n < 2) return str; // 9- is smallest but could be 23m- or 3 chars before a missing dash
    let s = str.substring(0, 2);
    if (isNumber(s))
    {
        s = str.substring(0,n) + "-";
        s += str.substring(n + 1);
        return s;
    }
    return str;
}


//"15-xxxx (yyyyyyy)"
function HasBothItems(str)
{
    var i, j, n;
    let strID = "";
    let strModel = "";
    str = str.trim();
    n = str.length;
    if (n < 16) return "";
    i = str.indexOf('(');
    if (i < 0) return "";
    j = str.indexOf(')', i);
    if (j < 0) return "";
    n = j - i;      // might want to remove country code
    if (n != 8) return "";
    strID = str.substring(i + 1, j);
    strModel = str.substring(0, i).trim();
    strModel = FixSpace(strModel);
    str = strModel + "(*)" + strID;
    if (str.length < 15) return "";
    return str;
}

function HasID(str) {
    var i, j, n;
    let strID = "";
    str = str.trim();
    n = str.length;
    if (n < 9) return "";
    i = str.indexOf('(');
    if (i < 0) return "";
    j = str.indexOf(')', i);
    if (j < 0) return "";
    n = j - i;
    if (n != 8) return "";
    strID = str.substring(i + 1, j);
    return strID;
}

//when looking up parts for printers, do not use e at end of printer name
function DropE(str) {
    var n = str.length - 1;
    if (n < 0) return str;
    var res = str.charAt(n);
    if (res == 'e') return str.substring(0, n);
    return str;
}


// do not want any white space in the lookup
// any trailing period or comma needs to be removed
function RemoveJunk(str) {
    var n = 0, res = "", str0;
    str = str.trim();
    str0 = str;

    //remove trailing periods, commas, dash, left parenthesis
    n = str.length - 1;
    if (n < 0) return "";
    res = str.charAt(n);
    if (res == '.' || res == ',' || res == '-' ) str0 = str.substring(0, n).trim();
    while (str0 != str) {
        str = str0;
        let n = str.length - 1;
        let res = str.charAt(n);
        if (res == '.' || res == ',' || res == '-' ) str0 = str.substring(0, n).trim();
    }
    str = str0;
    return str;
}

function RemoveParen(str) {
    var n = str.length, res = "", str0;
    if(n == 0)return "";
    str = str.trim();
    res = str.charAt(0);
    str0 = str;
    // remove leading junk not needed
    if (res == '.' || res == ',' || res == '(' || res == '-' || res == ')') str0 = str.substring(1, n).trim();

    while (str0 != str) {
        str = str0;
        res = str.charAt(0);
        if (res == '.' || res == ',' || res == '(' || res == '-' || res == ')') str0 = str.substring(1, n).trim();
    }
    str = str0;
    //remove trailing periods, commas or dash or junk
    n = str.length - 1;
    if (n < 0) return "";
    res = str.charAt(n);
    // trailing ( came from ENERGY STAR (ENERGY STAR)
    if (res == '.' || res == ',' || res == '-' || res == ')' || res == '(') str0 = str.substring(0, n).trim();

    while (str0 != str) {
        str = str0;
        n = str.length - 1;
        res = str.charAt(n);
        if (res == '.' || res == ',' || res == '-' || res == ')' || res == '(') str0 = str.substring(0, n).trim();
    }
    str = str0;
    return Rem_HP(str);
}


//replace sIn with pattrn sP but case insenstive
function MyReplace(sIN, sLC, sP) {
    var s = sP;
    var n = s.length;
    var b = "                     ";
    var c = "zzzzzzzzzzzzzzzzzzzzzzz";
    var i = sLC.indexOf(s);
    if (i < 0) return sIN;
    if (i == 0) {
        return b.substring(0, n) + sIN.substring(n);
    }
    else {
        return sIN.substring(0, i) + b.substring(0, n) + sIN.substring(i + n);
    }

}

// MyReplace does not change var t so duplicate require additional t = s 
function RemoveCommonItems(strIn)
{
    var s = " " + strIn + " ";
    var t = s.toLowerCase();
    var i = t.indexOf(" inch ");
    if (i > 0)
    {
        s = strIn.substring(i+6);
        t = s.toLowerCase();
    }
    s = MyReplace(s, t, " tags:");
    s = MyReplace(s, t, "\"");
    t = s.toLowerCase();
    s = MyReplace(s, t, "\"");
    t = s.toLowerCase();
    s = MyReplace(s, t, " hp ");
    s = MyReplace(s, t, " pc ");
    s = MyReplace(s, t, " aio ");
    s = MyReplace(s, t, " laptop ");
    s = MyReplace(s, t, " notebook ");
    s = MyReplace(s, t, " printer ");
    s = MyReplace(s, t, " all-in-one ");
    s = MyReplace(s, t, " ids base model ");
    // removed as some printer models might show up as laptops
    //s = MyReplace(s, t, " officejet ");
    //s = MyReplace(s, t, " laserjet ");
    //s = MyReplace(s, t, " deskjet ");
    s = MyReplace(s, t, " color ");
    s = MyReplace(s, t, " pavilion ");
    s = MyReplace(s, t, " convertible ");
    s = MyReplace(s, t, " compaq ");
    s = MyReplace(s, t, " product: ");
    s = MyReplace(s, t, " gaming ");
    s = MyReplace(s, t, " omen by ");
    s = MyReplace(s, t, " currently viewing: ");
    s = MyReplace(s, t, " energy star");
    s = MyReplace(s, t, " multifunction ");

    t = s.replace("  ", " ");
    while (t != s) {
        s = t;
        t = s.replace("  ", " ");
    }
    //console.log("RemoveCommonItems: s=" + s);
    return RemoveJunk(s);
}

//Currently Viewing: "HP Laptop PC 15-dw3000 (31R08AV)" in "Notebook Hardware and Upgrade Que
function CurrentlyViewing(strIn)
{
    var s = strIn;
    var t = "Currently Viewing: \"HP ";
    var i = s.indexOf(t);
    if (i < 0) return "";
    i += t.length;
    var j = s.indexOf("\"",i);
    if (i < 0) return "";
    return s.substring(i,j);
}

// 7/31/2026 trying to simplify tab creation
function CreateTabs(runFunction, tab, str, strID) {
    chrome.windows.create(
        {
            type: 'normal'
        },
        function (newWin) {

            chrome.tabs.query(
                {
                    windowId: newWin.id
                },
                function (tabs) {

                    // Run the appropriate routine
                    runFunction(tab, str, newWin.id, strID);

                    // Remove the blank tab Chrome created
                    if (tabs.length > 0) {
                        chrome.tabs.remove(tabs[0].id);
                    }
                }
            );
        }
    );
}

async function WaitForTabLoad(tabId) {
    return new Promise((resolve) => {

        function listener(updatedTabId, changeInfo) {

            if (updatedTabId === tabId &&
                changeInfo.status === "complete") {

                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(listener);
    });
}

//https://youtube.com/@HPSupport/search?query=deskjet%203755
function RunPRT(tab, str, id, sID) {
    var url0, url1, url2, url3, url4, url5;
    url5 = new URL(`https://youtube.com/@HPSupport/search?query=` + str);
    chrome.tabs.create({ url: url5.href, index: tab.index + 1 })
    url4 = new URL(`https://www.google.com/search`);
    url4.searchParams.set('q', Add_HP(str) + ' youtube network connect');
    chrome.tabs.create({ url: url4.href, windowId: id, index: tab.index + 1 });
    url3 = new URL(`https://www.google.com/search`);
    url3.searchParams.set('q', Add_HP(str) + ' youtube Wi-Fi direct');
    chrome.tabs.create({ url: url3.href, windowId: id, index: tab.index + 1 });
    url2 = new URL(`https://www.google.com/search`);
    url2.searchParams.set('q', Add_HP(str) + ' printer factory reset');
    chrome.tabs.create({ url: url2.href, windowId: id, index: tab.index + 1 });
    url0 = new URL(`https://partsurfer.hp.com`);
    url0.searchParams.set('searchtext', DropE(sID));
    chrome.tabs.create({ url: url0.href, windowId: id, index: tab.index + 1 });
    url1 = new URL(`https://support.hp.com/${hpLocale}/deviceSearch`);
    url1.searchParams.set('q', sID);
    url1.searchParams.append('origin', 'pdp');
    chrome.tabs.create({ url: url1.href, windowId: id, index: tab.index + 1 });

}

function RunAIO(tab, str, id, sID)
{
    var url1, url2, url3, url4;
    url4 = new URL(`https://www.google.com/search`);
    url4.searchParams.set('q', Add_HP(str) + ' software driver');
    chrome.tabs.create({ url: url4.href, windowId: id, index: tab.index + 1 });
    url3 = new URL(`https://www.google.com/search`);
    url3.searchParams.set('q', Add_HP(str) + ' disassembly');
    chrome.tabs.create({ url: url3.href, windowId: id, index: tab.index + 1 });
    url2 = new URL(`https://partsurfer.hp.com`);
    url2.searchParams.set('searchtext', RemoveCountryCode(sID));
    chrome.tabs.create({ url: url2.href, windowId: id, index: tab.index + 1 });
    url1 = new URL(`https://support.hp.com/${hpLocale}/deviceSearch`);
    url1.searchParams.set('q', sID);
    url1.searchParams.append('origin', 'pdp');
    chrome.tabs.create({ url: url1.href, windowId: id, index: tab.index + 1 });
}


function RunPC(tab, str, id, sID)
{
    var url1, url2, url3, url4;
    url4 = new URL(`https://www.google.com/search`);
    url4.searchParams.set('q', Add_HP(str) + ' software driver');
    chrome.tabs.create({ url: url4.href, windowId: id, index: tab.index + 1 });
    url2 = new URL(`https://partsurfer.hp.com`);
    url2.searchParams.set('searchtext', RemoveCountryCode(sID));
    chrome.tabs.create({ url: url2.href, windowId: id, index: tab.index + 1 });
    url1 = new URL(`https://support.hp.com/${hpLocale}/deviceSearch`);
    url1.searchParams.set('q', sID);
    url1.searchParams.append('origin', 'pdp');
    chrome.tabs.create({ url: url1.href, windowId: id, index: tab.index + 1 });
}

function Add_HP(str) {
    let HPIndex = str.indexOf("HP ");
    if (HPIndex < 0) {
        str = "HP " + str;
    }
    return str;
}

function Rem_HP(str) {
    let HPIndex = str.indexOf("HP ");
    if (HPIndex == 0) {
        str = str.substring(3);
    }
    return str;
}

function RemoveCountryCode(phrase) {
    return phrase.length === 11 && /#[A-Za-z0-9]{3}$/.test(phrase)
        ? phrase.slice(0, 7)
        : phrase;
}

async function CopyKhorosHtml() {

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        //console.log("CopyKhorosHtml: No selection");
        return;
    }

    if (selection.isCollapsed) {
        //console.log("CopyKhorosHtml: Selection is empty");
        return;
    }

    const range = selection.getRangeAt(0);

    // Clone the selected HTML.
    const fragment = range.cloneContents();

    const div = document.createElement("div");
    div.appendChild(fragment);

    // ------------------------------------------------------------
    // Convert Khoros-style image elements to the original form.
    // ------------------------------------------------------------

    div.querySelectorAll("img").forEach(oldImg => {

        const src = oldImg.getAttribute("src");

        if (!src)
            return;

        const newImg = document.createElement("img");

        newImg.setAttribute("src", src);

        oldImg.replaceWith(newImg);
    });

    /* possibly this was caused by using ENTER instead of SHIFT+ENTER.
    I may need the below code for a while longer*/

    if (true) {

        // Remove empty paragraphs created by Khoros/TinyMCE.
        div.querySelectorAll("p").forEach(p => {

            const text = p.textContent
                .replace(/\u00a0/g, "")
                .trim();

            const html = p.innerHTML
                .replace(/&nbsp;/gi, "")
                .replace(/<br\s*\/?>/gi, "")
                .trim();

            if (text === "" && html === "") {
                p.remove();
            }
        });
    }

    
    // Get the cleaned HTML.
    const html = div.innerHTML;

    // Plain text version.
    const plainText = div.textContent;

    //console.log("CopyKhorosHtml:");
    //console.log(html);

    // ------------------------------------------------------------
    // Copy both formats to the Windows clipboard.
    // ------------------------------------------------------------

    try {

        await navigator.clipboard.write([
            new ClipboardItem({
                "text/html": new Blob(
                    [html],
                    { type: "text/html" }
                ),

                "text/plain": new Blob(
                    [plainText],
                    { type: "text/plain" }
                )
            })
        ]);

        console.log("CopyKhorosHtml: Clipboard updated");
    }
    catch (error) {

        console.error(
            "CopyKhorosHtml: Clipboard write failed:",
            error
        );
    }
}

// jstateson:  extract product ID xxxxx from (xxxxx)
//  (HP M01-F2248nf)  changes to HP M01-F2248nf
// white spaces are dropped before and after the text
// F224nf. becomes F224nf
chrome.contextMenus.onClicked.addListener(async (item, tab) => {
    const tld = item.menuItemId;
    var url1, url2, url3, url4;
    var id;
    
    if (item.menuItemId == "FixS") {
        chrome.scripting.executeScript({
            target: {
                tabId: tab.id,
                allFrames: true
            },
            func: FixSpoilers
        });
        return;
    }

    if (item.menuItemId == "CopyKhorosHtml") {
        chrome.scripting.executeScript({
            target: {
                tabId: tab.id,
                allFrames: true
            },
            func: CopyKhorosHtml
        });
        return;
    }

    let SearchType = 0;
    if (item.menuItemId == "FindMyAnswers")
        SearchType = 1;
    else if (item.menuItemId == "FindThisPhrase")
        SearchType = 2;

    if (SearchType > 0) {
        const searchText = item.selectionText;
        const result_id = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: GetKhorosUserId
        });
        const userId = result_id?.[0]?.result ?? null;
        let results = [];
        let resultsUrl = [];
        switch (SearchType){
            case 1:
                results = await FindMyRepliesToPhrase(searchText, userId);
                //console.log("My matching replies:", results);
                await chrome.storage.session.set({
                    khorosSearchResults: {
                        searchText: searchText,
                        results: results
                    }
                });

                resultsUrl = chrome.runtime.getURL("searchResults.html");
                break;

            case 2:
                resultsUrl = BuildKhorosAuthorSearch(searchText, userId, 2, KhorosSearchRange.ALL);
        }
        chrome.tabs.create({
            url: resultsUrl,
            windowId: id,
            index: tab.index + 1
        });

        return;
    }

    if (item.menuItemId == "CitRem") {
        chrome.scripting.executeScript({
            target: {
                tabId: tab.id,
                allFrames: true
            },
            func: CleanPastedHtml
        });
        return;
    }

    if (item.menuItemId == "PutInSpoiler") {
        chrome.scripting.executeScript({
            target: {
                tabId: tab.id,
                allFrames: true
            },
            func: PutSelectedIntoSpoiler
        });
        return;
    }


    if (item.menuItemId == "StopSupportGPT") {
        supportGPTActive = false;
        return;
    }

    if (item.menuItemId == "AskSupportGPT") {
        if (!supportGPTActive) {
            return;
        }
        console.log("HP_SEARCH current forum tab ", tab.id);
        const appTab = await GetAppTab();
        console.log("HP_SEARCH appTab ID:", appTab.id);


        await chrome.storage.local.set({
            hpForumTabId: tab.id
        });

        chrome.tabs.sendMessage(appTab.id, {
            type: "SEND_SUPPORTGPT_TEXT",
            text: item.selectionText
        });
        return;
    }

    if (item.menuItemId == "StartSupportGPT") {
        await StartSupportGPT();
        return;
    }

    let productId = item.selectionText.trim();  // possibly contains a product ID in parentheses, e.g., (31R08AV) with a dash

    /*
    // Log each character and its Unicode code point to see if there are any non-standard characters
    for (const c of productId) {
        console.log(
            `"${c}" U+${c.codePointAt(0).toString(16).toUpperCase()}`
        );
    }
    */

    productId = productId
        .replace(/\u2010/g, "-")  // hyphen
        .replace(/\u2011/g, "-")  // non-breaking hyphen
        .replace(/\u2012/g, "-")  // figure dash
        .replace(/\u2013/g, "-")  // en dash
        .replace(/\u2014/g, "-"); // em dash

    let str1 = CurrentlyViewing(productId);
    //console.log("HP_Search: CurrentlyViewing str1:", str1);
    let str = RemoveCommonItems(productId);
    //console.log("HP_Search: RemoveCommonItems str:", str);
    str = FixSpace(str);
    //console.log("HP_Search: FixSpace str:", str);
    let strID = str;
    if (str1 == "") {
        let str2 = HasBothItems(str);
        if (str2 != "") {
            let i = str2.indexOf("(*)");
            if (i >= 0) {
                strID = str2.substring(i + 3);
                str = RemoveJunk(str.substring(0, i));
            }
        }
    }
    else
    {
        let str2 = HasBothItems(str1);
        if (str2 != "") {
            let i = str2.indexOf("(*)");
            if (i > 0) {
                strID = str2.substring(i + 3);
                str = RemoveCommonItems(str2.substring(0, i));
            }
        }
    }

    str = RemoveParen(str);
    strID = RemoveParen(strID);

    // Remove CTO and everything (junk?) after it and put back in
    // alert does not work here because it is running in the context of the background script, not the page
    // console.log("HP_Search: strID before CTO check: " + strID); // would have worked
    // do not use HP as a prefix for any HP site but add it in for google, bing, etc
    let ctoIndex = strID.indexOf("CTO");
    if (ctoIndex >= 0) {
        strID = strID.substring(0, ctoIndex).trim() + " CTO";
    }

    switch (tld)
    {
        case "PRN":
            RunPRT(tab, str, id, strID);
            break;

        case "AIO":
            RunAIO(tab, str, id, strID);
            break;

        case "PC":
            RunPC(tab, str, id, strID);
            break;

        case "OEM":
            url3 = new URL(`https://www.google.com/search`);
            url3.searchParams.set('q', Add_HP(str));
            chrome.tabs.create({ url: url3.href, index: tab.index + 1 });
            url2 = new URL(`https://www.google.com/search`);
            url2.searchParams.set('q', Add_HP(str) + " memory finder");
            chrome.tabs.create({ url: url2.href, windowId: id, index: tab.index + 1 });
            break;

        case "CR":
            const CtrnResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: GetHpLocation
            });
            let productId = item.selectionText.trim();
            const location = CtrnResult[0].result;
            let result = [];
            if (location === null) {
                //may have the full product id
                if (!/^[A-Za-z0-9]{7}#[A-Za-z0-9]{3}$/.test(productId)) {
                    return;
                }                
            }
            else {
                result = findHpCountry(location.country);
                // US is now returned instead of null for undefined languages
                if (result.matches.length > 1) {
                    await chrome.scripting.executeScript({
                        target: {
                            tabId: tab.id
                        },
                        func: ShowHpLanguages,
                        args: [location.country, result.matches]
                    });
                }
            }

            
            const listeners = new URL(CloudRecoveryUrl);
            const CR_tab = await chrome.tabs.create({ url: listeners.href, active: true });
            
            // First look for exactly (CCCCCCC), where C is alphanumeric
            const parenthesized = productId.match(/\(([A-Za-z0-9]{7})\)/);

            if (parenthesized) {
                if (result.matches.length > 0) {
                    productId = parenthesized[1] + result.matches[0][0];
                }
                else 
                    productId = parenthesized[1] + "#ABA";
            }
            else {

                if (productId.length == 7) {
                    productId = productId + result.matches[0][0];
                }
                else {
                    // Remove punctuation if the selected text is longer than 11 characters
                    if (productId.length > 11) {
                        productId = productId.replace(/[^A-Za-z0-9#]/g, "");
                    }
                    // Validate the resulting Product ID
                    if (!/^[A-Za-z0-9]{7}#[A-Za-z0-9]{3}$/.test(productId)) {
                        productId = "";
                    }
                }
            }
            if (productId === "")
                return;

            await WaitForTabLoad(CR_tab.id);
            await chrome.scripting.executeScript({
                target: { tabId: CR_tab.id },
                func: async (productId) => {

                    const form = document.querySelector("input.table-text").closest("form");
                    const input = document.querySelector("input.table-text");
                    const setter = Object.getOwnPropertyDescriptor(
                        HTMLInputElement.prototype,
                        "value"
                    ).set;

                    setter.call(input, productId);
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    input.dispatchEvent(new Event("change", { bubbles: true }));

                    // Give the page one event loop to update its state.
                    await new Promise(resolve => setTimeout(resolve, 500));
                    form.requestSubmit();

                },
                args: [productId]   // your 11-character Product ID
            });
            break;

        case "KB":
            url3 = new URL(`https://h30434.www3.hp.com/t5/forums/searchpage/tab/message?advanced=false&allow_punctuation=false&q=` + str);
            chrome.tabs.create({ url: url3.href, index: tab.index + 1 });
            break;

        case "EB":
            url2 = new URL(`https://partsurfer.hp.com`);
            url2.searchParams.set('searchtext', RemoveCountryCode(str));
            chrome.tabs.create({ url: url2.href, windowId: id, index: tab.index + 1 });
            let str0 = "https://www.ebay.com/sch/i.html?_nkw=" + Add_HP(str) + "&_sacat=58058" // 58058 is the computer catagory
            url3 = new URL(str0);
            chrome.tabs.create({ url: url3.href, index: tab.index + 2 });
            break;

        case "APrt": // cleaned up using advice from ChatGPT
            CreateTabs(RunPRT, tab, str, strID);break;

        case "APc":
            CreateTabs(RunPC, tab, str, strID);
            break;

        case "AAio":
            CreateTabs(RunAIO, tab, str, strID);
            break;
    }
});

