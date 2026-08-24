// Extract SOURCES from SupportGPT HTML and put them into a spoiler
function PutRefsIntoSpoiler(html) {
    const div = document.createElement("div");
    div.innerHTML = html;

    const sourcesHeader = [...div.querySelectorAll("h4")]
        .find(h => h.textContent.trim() === "SOURCES");

    if (!sourcesHeader) {
        console.log("HP_Search: No SOURCES found");
        return html;
    }

    let references = "";

    let node = sourcesHeader.nextElementSibling;

    while (node) {
        references += node.outerHTML;
        const next = node.nextElementSibling;
        node.remove();   // remove from original document
        node = next;
    }

    const parent = sourcesHeader.parentNode;

    const title = document.createElement("p");
    title.textContent = "Expand spoiler for references";

    const spoiler = document.createElement("div");
    spoiler.className = "lia-spoiler-container-editor";
    spoiler.innerHTML = references;

    // Insert before the SOURCES heading
    parent.insertBefore(title, sourcesHeader);
    parent.insertBefore(spoiler, sourcesHeader);

    // Now remove the SOURCES heading
    sourcesHeader.remove();
    return CleanSupportGPTHtml(div.innerHTML);
}

// Clean up the HTML from SupportGPT to make it suitable for Khoros (do not want a warning about html)
function CleanSupportGPTHtml(html) {

    const div = document.createElement("div");
    div.innerHTML = html;

    // Remove all <code> tags but keep their contents
    div.querySelectorAll("code").forEach(code => {
        code.replaceWith(...code.childNodes);
    });

    // Remove id="answer" (or any id attributes)
    div.querySelectorAll("#answer").forEach(element => {
        element.removeAttribute("id");
    });

    // Fix links so Khoros does not rewrite them
    div.querySelectorAll("a").forEach(a => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
    });

    return div.innerHTML;
}

document.getElementById("copyAnswer").addEventListener("click", async () => {

    const html = document.getElementById("answer").innerHTML;
    const text = document.getElementById("answer").innerText;

    try {
        await navigator.clipboard.write([
            new ClipboardItem({
                "text/html": new Blob([html], { type: "text/html" }),
                "text/plain": new Blob([text], { type: "text/plain" })
            })
        ]);

        console.log("HP_Search: Answer copied to clipboard");
    }
    catch (err) {
        console.error("Clipboard copy failed:", err.name, err.message);
    }
});

chrome.runtime.sendMessage({ type: "GET_HP_ACTIVITY" }, response => {

    if (!response || !response.activity) {
        document.getElementById("answer").textContent = "No answer available.";
        return;
    }

    const answerHTML1 = marked.parse(response.activity.text);
    const answerHTML = PutRefsIntoSpoiler(answerHTML1);

    document.getElementById("answer").innerHTML = answerHTML;
    console.log("HP_Search: assembled raw document");    
    /*
    window.postMessage({
        source: "HP_Search",
        type: "SUPPORTGPT_COMPLETE",
        html: answerHTML
    }, "*");
    */
       
    chrome.runtime.sendMessage({
        type: "SUPPORTGPT_HTML",
        html: answerHTML
    });
    
});