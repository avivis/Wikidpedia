document.getElementById("summarize").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript(
        {
            target: { tabId: tab.id },
            func: () => {
                const overview = Array.from(
                    document.querySelectorAll("#mw-content-text > div.mw-parser-output > p")
                )
                    .map((p) => p.innerText.trim())
                    .filter((text) => text && !text.startsWith("Etymology"))
                    .join("\n\n");

                return overview;
            },
        },
        async (results) => {
            if (results && results[0] && results[0].result) {
                const text = results[0].result;
                const summary = await summarizeText(text);
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: displaySummary,
                    args: [summary],
                });
            } else {
                console.error("Failed to extract overview text.");
            }
        }
    );
});

async function summarizeText(text) {
    const apiKey = API_KEY;
    const prompt = `Summarize the following text in 5 sentences:\n\n${text}`;
    const maxLength = 3000;
    const truncatedText = text.length > maxLength ? text.slice(0, maxLength) : text;
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: `Summarize the following text in 5 sentences:\n\n${truncatedText}` }],
                max_tokens: 1000,
                temperature: 0.7,
            }),
        });
        if (response.ok) {
            const data = await response.json();
            console.log("OpenAI API Response:", data);
            return data.choices[0].message.content.trim();
        } else {
            const errorText = await response.text();
            console.error("OpenAI API Error:", response.status, errorText);
            return `Error: Unable to fetch summary. Status: ${response.status}, Message: ${errorText}`;
        }
    } catch (error) {
        console.error("Error during API request:", error);
        return "Error: Failed to connect to the OpenAI API.";
    }
}


function displaySummary(summary) {
    const summaryDiv = document.createElement("div");
    summaryDiv.style.border = "1px solid gray";
    summaryDiv.style.padding = "10px";
    summaryDiv.style.margin = "10px 0";
    summaryDiv.innerHTML = `<h2>Summary</h2><p>${summary}</p>`;
    document.querySelector("#mw-content-text > div.mw-parser-output").prepend(summaryDiv);
}
