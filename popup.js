document.getElementById("complexity").addEventListener("input", (event) => {
    const complexityLevel = parseInt(event.target.value, 10);
    const gradeMap = {
        1: "Kindergarten",
        2: "1st Grade",
        3: "2nd Grade",
        4: "3rd Grade",
        5: "4th Grade",
        6: "5th Grade",
        7: "6th Grade",
        8: "7th Grade",
        9: "8th Grade",
        10: "High School",
        11: "College",
        12: "Masters",
        13: "PhD",
    };

    const gradeLabel = gradeMap[complexityLevel];
    document.getElementById("current-grade").innerText = gradeLabel;
});

document.getElementById("summarize").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const complexityLevel = document.getElementById("complexity").value; 

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
                const summary = await summarizeText(text, complexityLevel);
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

async function summarizeText(text, complexityLevel) {
    const apiKey = YOUR_API_KEY;
    const complexityMap = {
        1: "Explain it to a kindergartener.",
        2: "Explain it to a first grader.",
        3: "Explain it to a second grader.",
        4: "Explain it to a third grader.",
        5: "Explain it to a fourth grader.",
        6: "Explain it to a fifth grader.",
        7: "Explain it to a sixth grader.",
        8: "Explain it to a seventh grader.",
        9: "Explain it to an eighth grader.",
        10: "Explain it to a high school student.",
        11: "Explain at a complex level understood by a undergrad college student.",
        12: "Explain at a complex level understood by a masters student.",
        13: "Explain at a complex level understood by a PhD student.",
    };

    const instruction = complexityMap[complexityLevel];
    const reservedTokens = 1000; 
    const maxTokens = 16385 - reservedTokens;
    const truncatedText = truncateTextToFitTokens(text, instruction, maxTokens);
    const prompt = `Summarize the following text in 5 sentences:\n\n${truncatedText}\n\n${instruction}`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
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

function truncateTextToFitTokens(text, instruction, maxTokens) {
    const instructionTokens = Math.ceil(instruction.length / 4);
    const availableTokens = maxTokens - instructionTokens;
    const truncatedText = text.slice(0, availableTokens * 4); 
    return truncatedText;
}

function displaySummary(summary) {
    let summaryDiv = document.getElementById("summary-container");
    if (!summaryDiv) {
        summaryDiv = document.createElement("div");
        summaryDiv.id = "summary-container";
        summaryDiv.style.border = "1px solid gray";
        summaryDiv.style.padding = "10px";
        summaryDiv.style.margin = "10px 0";
        document.querySelector("#mw-content-text > div.mw-parser-output").prepend(summaryDiv);
    }
    summaryDiv.innerHTML = `<h2>Summary</h2><p>${summary}</p>`;
}

