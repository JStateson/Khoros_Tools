// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/*
This extension provides tools that can be used on Khoros pages
Joseph Stateson
Princial Analyst, Retired
Southwest Research Institute

Notes on Khoros:
searching explained: https://khoros-classic.kayako.com/article/124739-search-api-overview

*/


const hpLocale = "us-en";   // could change to in-en for india
const VirtualAgentUrl = "https://virtualagent.hpcloud.hp.com/"
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
        id: "FindPhrase",
        title: "Find my phrase or words",
        type: "normal",
        contexts: ['selection']
    });
    chrome.contextMenus.create({
        id: "FindReplies",
        title: "Replies this last week",
        type: "normal",
        contexts: ['selection']
    });
    chrome.contextMenus.create({
        id: "separator2",
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
        id: "ExpandDrivers",
        title: "Expand All Drives",
        type: "normal",
        contexts: ["all"]
    });
});


function ParseKhorosSearchText(searchText) {

    searchText = searchText.trim();

    let isExactPhrase = false;

    if (searchText.length >= 2) {

        const first = searchText[0];
        const last = searchText[searchText.length - 1];

        if (
            (first === '"' && last === '"') ||
            (first === "'" && last === "'")
        ) {
            isExactPhrase = true;
            searchText = searchText.slice(1, -1).trim();
        }
    }

    return {
        isExactPhrase: isExactPhrase,
        searchText: searchText
    };
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


async function SearchMyPosts(searchText, userId) {

    const query =
        "SELECT id, view_href, subject, author, topic, conversation " +
        "FROM messages " +
        "WHERE author.id = '" + userId + "' " +
        "AND (body MATCHES '" + searchText + "' OR subject MATCHES '" + searchText + "')" +
        "ORDER BY post_time DESC " +
        "LIMIT 20";

    const url =
        "https://h30434.www3.hp.com/api/2.0/search?q=" +
        encodeURIComponent(query);

    //console.log("search my posts ", url);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Khoros API error: ${response.status}`);
    }

    const result = await response.json();

    return result?.data?.items ?? [];
}


async function GetMyReplies(topicId, userId) {

    const query =
        "SELECT id, view_href, subject, author, post_time " +
        "FROM messages " +
        "WHERE topic.id = '" + topicId + "' " +
        "AND author.id = '" + userId + "' " +
        "ORDER BY post_time DESC, id DESC " +
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


// Search Khoros V2 for original topics containing the specified
// phrase, then use those topics to find my replies.  This finds
// my replies even when I did not use the phrase myself.
async function SearchKhorosApi(searchText, rangeTime) {

    let query =
        "SELECT id, view_href, author, subject, body, conversation " +
        "FROM messages " +
        "WHERE depth = 0 " +
        "AND body MATCHES '" + searchText + "' ";

    if (rangeTime != KhorosSearchRange.ALL) {

        const now = new Date();
        let startDate = new Date(now);

        switch (rangeTime) {
            case KhorosSearchRange.DAY:
                startDate.setDate(startDate.getDate() - 1);
                break;
            case KhorosSearchRange.WEEK:
                startDate.setDate(startDate.getDate() - 7);
                break;
            case KhorosSearchRange.MONTH:
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case KhorosSearchRange.YEAR:
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                throw new Error("Invalid Khoros search range: " + rangeTime);
        }

        const toISO = (d) =>
            d.toISOString().replace(/\.\d{3}Z$/, '+00:00');

        query +=
            "AND post_time > " + toISO(startDate) + " " +
            "AND post_time < " + toISO(now) + " ";
    }

    query +=
        "ORDER BY post_time DESC, id DESC " +
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


async function FindMyRepliesToPhrase(searchText, userId, krange) {

    const topics = await SearchKhorosApi(searchText, krange);
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


// Search Khoros V1 for posts/replies authored by me that contain
// the specified exact phrase.  These results are combined with
// Khoros V2 results that find my replies to topics where the
// original poster used the phrase.
async function SearchKhorosPhraseV1(searchText, userId, rangeTime) {

    let url =
        "https://h30434.www3.hp.com/restapi/vc/search/messages" +
        "?phrase=" + encodeURIComponent(searchText) +
        "&author_id=" + encodeURIComponent(userId) +
        "&include_forums=true&sort_by=date";

    if (rangeTime) {
        url += "&dateRangeType=rangeTime" +
            "&rangeTime=" + encodeURIComponent(rangeTime);
    }
    //console.log("phrase url ", url);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Khoros V1 API error: ${response.status}`);
    }

    const xmlText = await response.text();

    const messages = [];
    const messageRegex = /<message\b[\s\S]*?<\/message>/g;
    const messageBlocks = xmlText.match(messageRegex) ?? [];

    for (const block of messageBlocks) {

        const idMatch = block.match(
            /<id\b[^>]*>(.*?)<\/id>/
        );

        const subjectMatch = block.match(
            /<subject\b[^>]*>([\s\S]*?)<\/subject>/
        );

        if (!idMatch) {
            continue;
        }

        messages.push({
            id: idMatch[1],
            subject: subjectMatch?.[1] ?? "",
            source: "v1"
        });
    }

    return messages;
}



async function GetKhorosMessage(messageId) {

    const query =
        "SELECT id, view_href, subject, topic, author, conversation, post_time " +
        "FROM messages " +
        "WHERE id = '" + messageId + "'";

    const url =
        "https://h30434.www3.hp.com/api/2.0/search?q=" +
        encodeURIComponent(query);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Khoros API error: ${response.status}`);
    }

    const result = await response.json();

    return result?.data?.items?.[0] ?? null;
}

async function ConvertV1Results(v1Results) {

    const results = [];

    for (const item of v1Results) {

        const message = await GetKhorosMessage(item.id);

        if (message) {
            results.push(message);
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


    if (searchType === 2) {
        // Find these words
        const encodedSearch = encodeURIComponent(searchText).replace(/%20/g, "%2B");

        url += "&q=" + encodedSearch;
    }
    if (searchType === 1) {
        // Find this exact phrase
        url += "&phrase=" + encodeURIComponent(searchText);
    }

    url +=
        "&author_id=" + encodeURIComponent(userId) +
        "&include_forums=true";

    if (rangeTime) {
        url += "&rangeTime=" + encodeURIComponent(rangeTime);
    }

    url += "&sort_by=date";

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

    const tabs = await chrome.tabs.query({});

    const existingTab = tabs.find(tab =>
        tab.url && tab.url.startsWith(urlToFind)
    );

    if (existingTab) {
        //console.log("HP_Search:SupportGPT old tab ID:", existingTab.id);
        return existingTab;
    }
    const tab = await chrome.tabs.create({
        url: urlToFind
    });

    //console.log("HP_Search: SupportGPT new tab ID:", tab.id);

    return tab;
}

async function xWaitForSupportGPTButton(tabId) {
    //console.log("HP_Search: Waiting for SupportGPT button in tab", tabId);

    const response = await chrome.tabs.sendMessage(tabId, {
        action: "startSupportGPT"
    });

    /*
    if (response?.success) {
        console.log("SupportGPT started");
    }
    else {
        console.log("SupportGPT could not be started");
    }
    */
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
                //console.log("HP_Search: SupportGPT button clicked");
                return true;
            }
        }
        catch (e) {
            // tab may have closed or page not ready
            //console.log("HP_Search: injection failed", e.message);
            return false;
        }

        await new Promise(resolve => setTimeout(resolve, 250));
    }

    //console.log("HP_Search: SupportGPT button timeout");
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

    //console.log("HP_Search: Created new SupportGPT tab:", newTab.id);

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

        //console.log("HP_Search: Received HP answer:");
        //console.log(message.activity);
        RunSupportGPT(message.activity);
    }

    if (message.action === "contentReady") {
        //console.log("HP_Search: content ready in tab", sender.tab.id);
        await xWaitForSupportGPTButton(sender.tab.id);
    }

    if (message.type === "GET_HP_ACTIVITY") {
        //console.log("HP_Search: getting last activity");
        sendResponse({
            activity: lastActivity
        });
    }

    if (message.type === "SUPPORTGPT_HTML") {

        const saved = await chrome.storage.local.get("hpForumTabId");
        const hpTabId = saved.hpForumTabId;
        //console.log("HP_Search: SupportGPT HTML processed Forum ID ", hpTabId);
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
            //console.log("HP_Search: BK clicking SupportGPT");
            btn.click();
        }
        else {
            console.log("HP_Search: SupportGPT button not found");
        }
    }

});


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

    if (document.body.id !== "tinymce")
        return;

    const body = document.body;

    // Check for Google's "-bogus" markup before cleaning
    const pos = html.indexOf("-bogus");

    if (pos >= 0) {
        alert(
            html.substring(
                Math.max(0, pos - 500),
                Math.min(html.length, pos + 500)
            )
        );
    }

    // ---------------------------------------------------------
    // 1. Clean Google citation spans
    //    Keep only links from approved domains
    // ---------------------------------------------------------
    const allowedDomains = [
        "microsoft.com",
        "hp.com",
        "youtube.com",
        "wikipedia.org",
        "intel.com",
        "amd.com",
        "apple.com",
        "nvidia.com",
        "ebay.com",
        "amazon.com",
        "reddit.com"
    ];

    function IsAllowedFootnote(href) {

        if (!href)
            return false;

        try {
            const url = new URL(href);
            const hostname = url.hostname.toLowerCase();

            return allowedDomains.some(domain =>
                hostname === domain ||
                hostname.endsWith("." + domain)
            );

        } catch {
            return false;
        }
    }

    body.querySelectorAll("span").forEach(span => {

        const links = [...span.querySelectorAll("a")];

        // No links -- nothing to do
        if (links.length === 0)
            return;

        // ---------------------------------------------------------
        // Only process spans that contain citation numbers.
        //
        // Example:
        // [1, 2]
        // ---------------------------------------------------------
        const isCitationSpan = links.every(a =>
            /^\d+$/.test(a.textContent.trim())
        );

        if (!isCitationSpan)
            return;

        // Keep only links from approved domains
        const approvedLinks = links.filter(a =>
            IsAllowedFootnote(a.getAttribute("href"))
        );

        // No approved citations -- remove the citation span
        if (approvedLinks.length === 0) {
            span.remove();
            return;
        }

        // ---------------------------------------------------------
        // Rebuild the citation span
        // ---------------------------------------------------------
        const fragment = document.createDocumentFragment();

        fragment.appendChild(
            document.createTextNode("[")
        );

        approvedLinks.forEach((a, index) => {

            if (index > 0) {
                fragment.appendChild(
                    document.createTextNode(", ")
                );
            }

            const newA = document.createElement("a");

            newA.href = a.getAttribute("href");
            newA.target = "_blank";
            newA.rel = "noopener";
            newA.textContent = a.textContent.trim();

            fragment.appendChild(newA);
        });

        fragment.appendChild(
            document.createTextNode("]")
        );

        span.replaceChildren(fragment);
    });

    let html = body.innerHTML;

    // ---------------------------------------------------------
    //2. Remove GEMINI estimated time to complete
    // ---------------------------------------------------------
    html = html.replace(
        /\s*\d+(?:[-–]\d+)?\s*(?:min(?:ute)?s?|hours?|hrs?)(?:\s+\d+\s*(?:min(?:ute)?s?))?\./gi,
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

    /*

    html = html.replace(
        /<div\b[^>]*>/gi,
        ""
    );

    html = html.replace(
        /<\/div>/gi,
        "<br>"
    );

    */

    // ---------------------------------------------------------
    // Preserve paragraph breaks between Google wrapper <div>s
    // ---------------------------------------------------------
    html = html.replace(
        /<\/div>\s*<\/div>\s*<div\b[^>]*>\s*<div\b[^>]*>/gi,
        "<br><br>"
    );

    // removed the above two that are commented out and trying the below to fix double space problems

    html = html.replace(
        /<\/?div\b[^>]*>/gi,
        ""
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

    // 9. remove chatgpt references

    html = html.replace("?utm_source=chatgpt.com", "");


    body.innerHTML = html;

    // switch to DOM manipulation for the rest of the cleanup

    body.querySelectorAll("a").forEach(a => {

        const href = a.getAttribute("href");
        if (!href) return;

        // Preserve the original link
        [...a.attributes].forEach(attr => a.removeAttribute(attr.name));

        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";

        // Change numeric link text to ref_1, ref_2, etc.
        const text = a.textContent.trim();

        if (/^\d+$/.test(text)) {
            a.textContent = "ref_" + text;
        }
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

    /*  THIS WAS PUT IN BY HP AND IS NOT NEEDED ANYMORE, BUT MAYBE I WILL NEED IT AGAIN LATER
    // Remove any scripts left in pasted Google HTML
    body.querySelectorAll("script").forEach(script => {
        script.remove();
    });
    */

    // Tell TinyMCE/Khoros that the content has changed
    body.dispatchEvent(
        new InputEvent("input", { bubbles: true })
    );

    body.dispatchEvent(
        new Event("change", { bubbles: true })
    );
}

async function ExpandDrivers() {

    const rows = document.querySelectorAll(
        'tr.pfw-driver-row:not(.expanded)'
    );

    for (const row of rows) {

        const arrow = row.querySelector('.pfw-driver-row-toggle');

        if (!arrow)
            continue;

        arrow.dispatchEvent(new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window
        }));

        await new Promise(resolve => setTimeout(resolve, 500));

        // Check again because the page can modify the row
        if (!row.classList.contains('expanded')) {

            arrow.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            }));

            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
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

        //console.log("CopyKhorosHtml: Clipboard updated");
    }
    catch (error) {

        console.error("CopyKhorosHtml: Clipboard write failed:",error);
    }
}

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
    if (item.menuItemId == "FindPhrase")
        SearchType = 1;
    else if (item.menuItemId == "FindReplies")
        SearchType = 3;



    if (SearchType > 0) {
        const parsed = ParseKhorosSearchText(item.selectionText);
        if (!parsed.isExactPhrase)
            SearchType++;
        const searchText = parsed.searchText;
        const result_id = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: GetKhorosUserId
        });
        const userId = result_id?.[0]?.result ?? null;
        let results = [];
        let resultsUrl = [];

        if (SearchType < 3 && !parsed.isExactPhrase) {

            if (true) {
                resultsUrl = BuildKhorosAuthorSearch(searchText, userId, SearchType, KhorosSearchRange.ALL);
                //console.log("Build url ", resultsUrl);
                chrome.tabs.create({
                    url: resultsUrl,
                    windowId: id,
                    index: tab.index + 1
                });
                return;
            }

            results = await SearchMyPosts(searchText, userId);
            
            //console.log("My matching replies:", results);
            await chrome.storage.session.set({
                khorosSearchResults: {
                    searchText: searchText,
                    searchType: 1,
                    results: results
                }
            });
            resultsUrl = chrome.runtime.getURL("searchResults.html");
            //console.log("Build url ", resultsUrl);
            chrome.tabs.create({
                url: resultsUrl,
                windowId: id,
                index: tab.index + 1
            });
            return;
        }
        let kRange = KhorosSearchRange.ALL;
        if (SearchType > 2)
            kRange = KhorosSearchRange.WEEK;
        const v1Results = await SearchKhorosPhraseV1(
            searchText,
            userId,
            kRange
        );

        //console.log("V1 results:", v1Results);

        const v1Messages = await ConvertV1Results(v1Results);

        //console.log("V1 converted messages:", v1Messages);

        const v2Results =
            await FindMyRepliesToPhrase(searchText, userId, kRange);

        //console.log("V2 results:", v2Results);

        const combinedResults = [...v1Messages];

        const seenIds = new Set(
            combinedResults.map(message => message.id)
        );

        for (const item of v2Results) {

            const message = item.message;

            if (!message?.id) {
                continue;
            }

            if (!seenIds.has(message.id)) {
                combinedResults.push(message);
                seenIds.add(message.id);
            }
        }

        //console.log("Combined unique messages:", combinedResults);

        await chrome.storage.session.set({
            khorosSearchResults: {
                searchText: searchText,
                searchType: 1,
                searchRange: kRange,
                results: combinedResults
            }
        });

        resultsUrl =
            chrome.runtime.getURL("searchResults.html");


        chrome.tabs.create({
            url: resultsUrl,
            windowId: id,
            index: tab.index + 1
        });

        return;


    }

    if (item.menuItemId == "ExpandDrivers") {
        chrome.scripting.executeScript({
            target: {
                tabId: tab.id //,                allFrames: true
            },
            func: ExpandDrivers
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
        //console.log("HP_SEARCH current forum tab ", tab.id);
        const appTab = await GetAppTab();
        //console.log("HP_SEARCH appTab ID:", appTab.id);


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

});

