document.addEventListener("DOMContentLoaded", async () => {

    const data = await chrome.storage.session.get("khorosSearchResults");

    const searchText = data.khorosSearchResults?.searchText ?? "";
    const results = data.khorosSearchResults?.results ?? [];

    document.getElementById("title").textContent =
        `Khoros Search: ${searchText}`;

    document.getElementById("summary").textContent =
        `${results.length} matching post${results.length === 1 ? "" : "s"}`;

    const container = document.getElementById("results");

    if (results.length === 0) {
        container.innerHTML =
            `<div id="no-results">No matching posts were found.</div>`;
        return;
    }

    for (const item of results) {

        const details = document.createElement("details");

        const summary = document.createElement("summary");

        summary.textContent = item.topicSubject;

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
        link.textContent = item.message.subject;

        post.appendChild(link);

        const id = document.createElement("span");
        id.className = "post-id";
        id.textContent = `  (${item.message.id})`;

        post.appendChild(id);

        details.appendChild(post);
        container.appendChild(details);
    }
});