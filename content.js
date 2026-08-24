console.log("HP_Search content.js loaded:", location.href);
chrome.runtime.sendMessage({
    action: "contentReady"
});



function WaitForSupportGPTButton() {
    return new Promise((resolve) => {

        const startTime = Date.now();
        const timeout = 5000;

        const timer = setInterval(() => {

            const btn = [...document.querySelectorAll("button")]
                .find(b =>
                    b.getAttribute("aria-label") ===
                    "Chat with HP's SupportGPT for AI Answers"
                );

            if (btn && btn.isConnected && !btn.disabled) {

                console.log("HP_Search: clicking SupportGPT button");
                console.log(btn.outerHTML);

                btn.focus();
                btn.click();

                clearInterval(timer);
                resolve(true);
                return;
            }

            if (Date.now() - startTime >= timeout) {
                clearInterval(timer);
                console.log("HP_Search: SupportGPT button timeout");
                resolve(false);
            }

        }, 250);

    });
}
window.addEventListener("message", function (event) {
    //console.log("HP_Search CT: event.data =", JSON.stringify(event.data, null, 2));
    //console.log("HP_Search CT: type =", event.data.type);

    if (event.data.source === "HP_Search") {
        console.log("HP_Search CT: My message:", event.data);
    }

    if (event.source !== window)
        return;

    if (event.data.source === "HP_Search" &&
        event.data.type === "HP_ANSWER_HELP") {

        console.log("HP_Search: content.js received answer");

        chrome.runtime.sendMessage({    // send message to background.js
            type: "HP_ANSWER",
            activity: event.data.activity
        });
        return;
    }

    if (event.data.type === "SUPPORTGPT_COMPLETE") {

        console.log(
            "HP_Search CT: SupportGPT HTML received:",
            event.data.html
        );

        chrome.runtime.sendMessage({
            type: "SUPPORTGPT_HTML",
            html: event.data.html
        });
    }
});


// Inject page-level script (inject.js)
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = function () {
    this.remove();
};

function SendSupportGPTText(text) {

    const input = document.querySelector(
        'input[data-id="webchat-sendbox-input"]'
    );

    if (!input) {
        console.log("HP_Search: SupportGPT input not found");
        return;
    }

    // Set value using the native setter so React sees it
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
    ).set;

    setter.call(input, text);

    // Tell React/Web Chat that the value changed
    input.dispatchEvent(new Event("input", {
        bubbles: true
    }));

    input.dispatchEvent(new Event("change", {
        bubbles: true
    }));

    console.log("HP_Search: Text entered into SupportGPT");
    const button = document.querySelector('button.webchat__send-box__button');
    console.log("HP_Search: Button disabled:", button.disabled);
    
    button.click();
}



(document.head || document.documentElement).appendChild(script);


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === "CLICK_SUPPORTGPT") {

        const btn = [...document.querySelectorAll("button")]
            .find(b => b.innerText.trim() ===
                "Chat with HP's SupportGPT for AI Answers");

        if (btn) {
            console.log("HP_Search: CT clicking SupportGPT");
            btn.click();
        }
        else {
            console.log("HP_Search: CT SupportGPT button not found");
        }
        return;
    }

    if (message.type === "SEND_SUPPORTGPT_TEXT") {
        SendSupportGPTText(message.text);
        return;
    }

    if (message.action === "startSupportGPT") {

        WaitForSupportGPTButton()
            .then(found => {
                console.log("HP_Search CT: sending SupportGPT result", found);
                sendResponse({ success: found });
            });

        return true;
    }

    //below not to be used, but kept for reference
    if (message.type === "COPY_SUPPORTGPT_HTML") {

        const html = message.html;

        navigator.clipboard.write([
            new ClipboardItem({
                "text/html": new Blob(
                    [html],
                    { type: "text/html" }
                ),
                "text/plain": new Blob(
                    [html],
                    { type: "text/plain" }
                )
            })
        ])
            .then(() => {
                console.log("HP_Search: HTML copied to clipboard");
            })
            .catch(err => {
                console.error("Clipboard error:", err);
            });
    }

});