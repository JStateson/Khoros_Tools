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
});


function GetKhorosUserId() {
    const html = document.documentElement.innerHTML;

    const match = html.match(
        /"User"\s*:\s*\{[\s\S]*?"id"\s*:\s*(\d+)/
    );

    if (!match)
        return null;

    return match[1];
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

});

