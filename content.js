(function () {
    const container = document.createElement("div");
    container.id = "wikipedia-summarizer";
    container.style.position = "fixed";
    container.style.bottom = "20px";
    container.style.right = "20px";
    container.style.backgroundColor = "#f8f9fa";
    container.style.border = "1px solid #a2a9b1";
    container.style.borderRadius = "8px";
    container.style.padding = "15px";
    container.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.1)";
    container.style.zIndex = "10000";
    container.style.width = "350px";
    const title = document.createElement("h3");
    title.innerText = "Summarize this page!";
    title.style.fontFamily = "Georgia, serif";
    title.style.marginBottom = "10px";
    container.appendChild(title);
    const sliderLabel = document.createElement("div");
    sliderLabel.style.display = "flex";
    sliderLabel.style.justifyContent = "space-between";
    sliderLabel.style.alignItems = "center";
    sliderLabel.style.marginBottom = "5px";
    sliderLabel.innerHTML = `
      <span style="font-size: 12px; font-family: Georgia, serif;">Kindergarten</span>
      <span style="font-size: 12px; font-family: Georgia, serif;">PhD</span>`;
    container.appendChild(sliderLabel);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "1";
    slider.max = "13";
    slider.value = "1";
    slider.style.width = "100%";
    slider.style.marginBottom = "10px";
    slider.style.appearance = "none";
    slider.style.background = "#a2a9b1";
    slider.style.height = "5px";
    slider.style.borderRadius = "5px";
    slider.style.outline = "none";
    slider.style.cursor = "pointer";
  
    const sliderThumb = `
      input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        width: 12px;
        height: 12px;
        background: black;
        border-radius: 50%;
        cursor: pointer;
      }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = sliderThumb;
    document.head.appendChild(styleSheet);
    container.appendChild(slider);
    const gradeDisplay = document.createElement("div");
    gradeDisplay.innerText = "Kindergarten";
    gradeDisplay.style.fontFamily = "Georgia, serif";
    gradeDisplay.style.textAlign = "center";
    gradeDisplay.style.marginBottom = "10px";
    container.appendChild(gradeDisplay);
  
    slider.addEventListener("input", () => {
      const grades = [
        "Kindergarten",
        "1st Grade",
        "2nd Grade",
        "3rd Grade",
        "4th Grade",
        "5th Grade",
        "6th Grade",
        "7th Grade",
        "8th Grade",
        "High School",
        "Undergraduate",
        "Master's",
        "PhD",
      ];
      gradeDisplay.innerText = grades[slider.value - 1];
    });
  
    const summarizeButton = document.createElement("button");
    summarizeButton.innerText = "Summarize";
    summarizeButton.style.backgroundColor = "#eaf3ff";
    summarizeButton.style.border = "1px solid #a2a9b1";
    summarizeButton.style.borderRadius = "5px";
    summarizeButton.style.padding = "10px";
    summarizeButton.style.width = "100%";
    summarizeButton.style.cursor = "pointer";
    summarizeButton.style.fontFamily = "Georgia, serif";
    summarizeButton.addEventListener("click", async () => {
      const paragraphs = Array.from(
        document.querySelectorAll("#mw-content-text > div.mw-parser-output > p")
      )
        .map((p) => p.innerText.trim())
        .filter((text) => text && !text.startsWith("Etymology"))
        .join("\n\n");
  
      const maxTokens = 16384;
      const promptBase = `Summarize the following text for a ${gradeDisplay.innerText} level in 5 sentences:\n\n`;
      const estimatedPromptTokens = Math.ceil(promptBase.length / 4); 
      const remainingTokens = maxTokens - estimatedPromptTokens;
  
      function truncateText(text, maxTokens) {
        const words = text.split(/\s+/);
        let truncatedText = "";
        let tokenCount = 0;
        for (const word of words) {
          const wordTokens = Math.ceil(word.length / 4);
          if (tokenCount + wordTokens > maxTokens) break;
          truncatedText += word + " ";
          tokenCount += wordTokens;
        }
  
        return truncatedText.trim();
      }
  
      const truncatedText = truncateText(paragraphs, remainingTokens);
      if (truncatedText.length < paragraphs.length) {
        console.warn("Input text was truncated to fit within the token limit.");
      }
  
      const prompt = `${promptBase}${truncatedText}`;
      const summary = await fetchSummary(prompt);
      let summaryDiv = document.getElementById("generated-summary");
      if (!summaryDiv) {
        summaryDiv = document.createElement("div");
        summaryDiv.id = "generated-summary";
        summaryDiv.style.border = "1px solid gray";
        summaryDiv.style.padding = "10px";
        summaryDiv.style.marginTop = "20px";
  
        const summaryLabel = document.createElement("h2");
        summaryLabel.innerText = "Summary";
        summaryDiv.appendChild(summaryLabel);
  
        document.querySelector("#mw-content-text > div.mw-parser-output").prepend(summaryDiv);
      } else {
        summaryDiv.innerHTML = "<h2>Summary</h2>";
      }
  
      const summaryContent = document.createElement("p");
      summaryContent.innerText = summary;
      summaryDiv.appendChild(summaryContent);
    });
    container.appendChild(summarizeButton);
    document.body.appendChild(container);
  
    async function fetchSummary(prompt) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer YOUR_API_KEY`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1000,
            temperature: 0.7,
          }),
        });
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error("HTTP Error:", response.status, response.statusText, errorText);
          return `HTTP Error: ${response.status} - ${response.statusText}. Details: ${errorText}`;
        }
  
        const data = await response.json();
        return data.choices[0].message.content.trim();
      } catch (error) {
        console.error("Network or Other Error:", error);
        return `Network or Other Error: ${error.message}`;
      }
    }
  })();
  
