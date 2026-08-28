document.addEventListener("DOMContentLoaded", async () => {

    const data = await chrome.storage.session.get("khorosSearchResults");
    const searchData = data.khorosSearchResults;

    if (!searchData) {
        document.getElementById("summary").textContent =
            "No search results available.";
        return;
    }

    const searchText = searchData.searchText ?? "";
    const searchType = searchData.searchType ?? 1;
    const results = searchData.results ?? [];
    const searchRange = searchData.searchRange;

    let rangeText = "";

    switch (searchRange) {
        case null:
            rangeText = "All time";
            break;

        case "24h":
            rangeText = "Last 24 hours";
            break;

        case "1w":
            rangeText = "Last week";
            break;

        case "1M":
            rangeText = "Last month";
            break;

        case "1y":
            rangeText = "Last year";
            break;

        default:
            rangeText = "";
    }


    document.getElementById("title").textContent =
        `Khoros Search: ${searchText}`;

    document.getElementById("summary").textContent =
        `${results.length} matching post${results.length === 1 ? "" : "s"}— ${rangeText}`;

    const container = document.getElementById("results");

    if (results.length === 0) {
        container.innerHTML =
            `<div id="no-results">No matching posts were found.</div>`;
        return;
    }

    if (searchType === 1) {
        DisplayType1Results(results, container);
    }
    else if (searchType === 2) {
        DisplayType2Results(results, container); //2 is not used
    }
});

function DisplayType1Results(results, container) {

    for (const message of results) {

        const div = document.createElement("div");
        div.className = "result";

        const link = document.createElement("a");

        link.href = message.view_href;
        link.target = "_blank";
        link.textContent = message.subject ?? "(no subject)";

        div.appendChild(link);

        const id = document.createElement("span");
        id.className = "post-id";
        id.textContent = `  (${message.id})`;

        div.appendChild(id);

        container.appendChild(div);
    }
}


function DisplayType2Results(results, container) {

    for (const item of results) {

        const details = document.createElement("details");

        const summary = document.createElement("summary");

        summary.textContent =
            item.topicSubject ?? "(no subject)";

        if (item.topicAuthor) {
            const author = document.createElement("span");
            author.className = "topic-author";
            author.textContent = `  — ${item.topicAuthor}`;
            summary.appendChild(author);
        }

        details.appendChild(summary);

        const post = document.createElement("div");
        post.className = "post";

        const link = document.createElement("a");

        link.href = item.message.view_href;
        link.target = "_blank";
        link.textContent =
            item.message.subject ?? "(no subject)";

        post.appendChild(link);

        const id = document.createElement("span");
        id.className = "post-id";
        id.textContent = `  (${item.message.id})`;

        post.appendChild(id);

        details.appendChild(post);
        container.appendChild(details);
    }
}