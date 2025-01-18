(function () {
    const BATCH_SIZE = 3; 
    const MIN_SECTION_LENGTH = 100; 
    const MAX_RETRIES = 3; 
    const RETRY_DELAY = 1000;
    const CACHE_DURATION = 24 * 60 * 60 * 1000;
    const DEBOUNCE_DELAY = 500;

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

    const sliderLabel = document.createElement("div");
    sliderLabel.style.display = "flex";
    sliderLabel.style.justifyContent = "space-between";
    sliderLabel.style.alignItems = "center";
    sliderLabel.style.marginBottom = "5px";
    sliderLabel.innerHTML = `
      <span style="font-size: 12px; font-family: Arial, sans-serif;">Kindergarten</span>
      <span style="font-size: 12px; font-family: Arial, sans-serif;">PhD</span>
    `;
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
    gradeDisplay.style.fontFamily = "Arial, sans-serif";
    gradeDisplay.style.textAlign = "center";
    gradeDisplay.style.marginBottom = "10px";
    gradeDisplay.style.fontSize = "14px";
    container.appendChild(gradeDisplay);

    let debounceTimer;
    slider.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const grades = [
                "Kindergarten", "1st Grade", "2nd Grade", "3rd Grade",
                "4th Grade", "5th Grade", "6th Grade", "7th Grade",
                "8th Grade", "High School", "Undergraduate", "Master's", "PhD"
            ];
            gradeDisplay.innerText = grades[slider.value - 1];
        }, DEBOUNCE_DELAY);
    });

    const cacheManager = {
        generateKey(pageTitle, sectionHeading, gradeLevel) {
            return `wiki-summary:${pageTitle}:${sectionHeading}:${gradeLevel}`;
        },

        get(pageTitle, sectionHeading, gradeLevel) {
            const key = this.generateKey(pageTitle, sectionHeading, gradeLevel);
            try {
                const cached = localStorage.getItem(key);
                if (cached) {
                    const { summary, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        return summary;
                    }
                    localStorage.removeItem(key);
                }
            } catch (error) {
                console.error('Cache retrieval error:', error);
            }
            return null;
        },

        set(pageTitle, sectionHeading, gradeLevel, summary) {
            const key = this.generateKey(pageTitle, sectionHeading, gradeLevel);
            try {
                const cacheEntry = {
                    summary,
                    timestamp: Date.now()
                };
                localStorage.setItem(key, JSON.stringify(cacheEntry));
            } catch (error) {
                console.error('Cache storage error:', error);
                if (error.name === 'QuotaExceededError') {
                    this.clearOldEntries();
                    try {
                        localStorage.setItem(key, JSON.stringify(cacheEntry));
                    } catch (retryError) {
                        console.error('Cache storage retry failed:', retryError);
                    }
                }
            }
        },

        clearOldEntries() {
            const keys = Object.keys(localStorage);
            const wikiSummaryKeys = keys.filter(key => key.startsWith('wiki-summary:'));
            
            const entries = wikiSummaryKeys.map(key => {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    return { key, timestamp: data.timestamp };
                } catch (error) {
                    return { key, timestamp: 0 };
                }
            });

            entries.sort((a, b) => a.timestamp - b.timestamp);
            const removeCount = Math.ceil(entries.length * 0.2);
            entries.slice(0, removeCount).forEach(entry => {
                localStorage.removeItem(entry.key);
            });
        }
    };

    async function fetchSummaryWithRetry(prompt, retryCount = 0) {
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
                    temperature: 0.3,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAY * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchSummaryWithRetry(prompt, retryCount + 1);
            }
            throw error;
        }
    }

    async function batchFetchSummaries(sections, pageTitle, currentGradeLevel) {
        const batches = [];
        for (let i = 0; i < sections.length; i += BATCH_SIZE) {
            const batch = sections.slice(i, i + BATCH_SIZE);
            batches.push(batch);
        }

        const results = [];
        for (const batch of batches) {
            const batchPrompt = batch.map(section => {
                return `Section: "${section.heading.innerText}"
Content: ${section.content.join("\n\n")}
---`;
            }).join("\n\n");

            const prompt = `You are summarizing ${batch.length} sections from the Wikipedia article "${pageTitle}".
Create clear, factual summaries for each section at a ${currentGradeLevel} reading level.
Use 3-5 sentences per section and focus only on the key information presented. 
Format your response as:
[Section Title 1]
Summary 1

[Section Title 2]
Summary 2

Here are the sections to summarize:

${batchPrompt}`;

            try {
                const response = await fetchSummaryWithRetry(prompt);
                const summaries = response.split(/\[.*?\]\n/).filter(Boolean);
                results.push(...summaries.map(summary => summary.trim()));
            } catch (error) {
                results.push(`Error generating summary: ${error.message}`);
            }
        }
        return results;
    }

    function createSummaryParagraph(summary) {
        const paragraph = document.createElement("p");
        paragraph.style.margin = "1em 0";
        paragraph.style.lineHeight = "1.6";
        paragraph.innerText = summary;
        return paragraph;
    }

    let isProcessing = false;
    const summarizeButton = document.createElement("button");
    summarizeButton.innerText = "Summarize this page!";
    summarizeButton.style.backgroundColor = "#eaf3ff";
    summarizeButton.style.border = "1px solid #a2a9b1";
    summarizeButton.style.borderRadius = "5px";
    summarizeButton.style.padding = "10px";
    summarizeButton.style.width = "100%";
    summarizeButton.style.cursor = "pointer";
    summarizeButton.style.fontFamily = "'Times New Roman', serif";
    summarizeButton.style.fontSize = "16px";

    summarizeButton.addEventListener("click", async () => {
        if (isProcessing) return;
        isProcessing = true;
        summarizeButton.disabled = true;
        summarizeButton.style.opacity = "0.5";

        try {
            const contentDiv = document.querySelector("#mw-content-text > div.mw-parser-output");
            if (!contentDiv) {
                throw new Error("Could not find Wikipedia content div");
            }

            const sections = [];
            const pageTitle = document.querySelector("#firstHeading")?.innerText || "Wikipedia article";
            const currentGradeLevel = gradeDisplay.innerText;

            const skipSections = new Set([
                'External links',
                'Further reading',
                'References',
                'Notes',
                'Bibliography',
                'See also',
                'Citations',
                'Sources',
                'Navigation menu'
            ]);
            
            const shouldSkipElement = (element) => {
                return element.classList.contains("hatnote") ||
                    element.tagName === "STYLE" ||
                    element.tagName === "LINK" ||
                    element.classList.contains("ombox") ||
                    (element.tagName === "DIV" && element.getAttribute("role") === "note") ||
                    element.id === "toc" ||
                    element.classList.contains("navbox") ||
                    element.classList.contains("navigation-box") ||
                    element.classList.contains("infobox");
            };
            
            let introContent = [];
            let introNode = contentDiv.firstElementChild;
            
            while (introNode && shouldSkipElement(introNode)) {
                introNode = introNode.nextElementSibling;
            }
            
            while (introNode && !introNode.classList.contains("mw-heading")) {
                if (introNode.tagName === "P") {
                    const text = introNode.innerText.trim();
                    if (text) {
                        introContent.push(text);
                    }
                }
                introNode = introNode.nextElementSibling;
            }
            
            if (introContent.length > 0) {
                const introHeading = document.createElement("h2");
                introHeading.innerText = "Introduction";
                sections.push({
                    heading: introHeading,
                    content: introContent
                });
            }
            
            let currentSection = null;
            let currentHeading = null;
            
            for (const element of contentDiv.children) {
                if (shouldSkipElement(element)) {
                    continue;
                }
            
                if (element.classList.contains("mw-heading")) {
                    const headingText = element.innerText.trim();
                    
                    if (currentHeading && currentSection && currentSection.length > 0 && 
                        !skipSections.has(currentHeading.innerText.trim())) {
                        sections.push({
                            heading: currentHeading,
                            content: currentSection
                        });
                    }
            
                    if (!skipSections.has(headingText)) {
                        currentHeading = element.cloneNode(true);
                        currentSection = [];
                    } else {
                        currentHeading = null;
                        currentSection = null;
                    }
                } else if (element.tagName === "P" && currentSection !== null) {
                    const text = element.innerText.trim();
                    if (text) {
                        currentSection.push(text);
                    }
                }
            }
            
            if (currentHeading && currentSection && currentSection.length > 0 && 
                !skipSections.has(currentHeading.innerText.trim())) {
                sections.push({
                    heading: currentHeading,
                    content: currentSection
                });
            }

            while (contentDiv.firstChild) {
                contentDiv.removeChild(contentDiv.firstChild);
            }

            for (const section of sections) {
                const sectionText = section.content.join("\n\n");
                const sectionHeading = section.heading.innerText || "Section";
                if (sectionText.length < MIN_SECTION_LENGTH) {
                    contentDiv.appendChild(section.heading.cloneNode(true));
                    contentDiv.appendChild(createSummaryParagraph(sectionText));
                    await new Promise(resolve => setTimeout(resolve, 300));
                    continue;
                }

                const cached = cacheManager.get(pageTitle, sectionHeading, currentGradeLevel);
                if (cached) {
                    contentDiv.appendChild(section.heading.cloneNode(true));
                    contentDiv.appendChild(createSummaryParagraph(cached));
                    await new Promise(resolve => setTimeout(resolve, 300));
                    continue;
                }

                const batchResult = await batchFetchSummaries([section], pageTitle, currentGradeLevel);
                const summary = batchResult[0];
                
                cacheManager.set(pageTitle, sectionHeading, currentGradeLevel, summary);
                
                contentDiv.appendChild(section.heading.cloneNode(true));
                contentDiv.appendChild(createSummaryParagraph(summary));
                
                await new Promise(resolve => setTimeout(resolve, 300));
            }

        } catch (error) {
            console.error("Error processing page:", error);
            alert(`An error occurred while processing the page: ${error.message}`);
        } finally {
            isProcessing = false;
            summarizeButton.disabled = false;
            summarizeButton.style.opacity = "1";
        }
    });

    const clearCacheButton = document.createElement("button");
    clearCacheButton.innerText = "Clear Cached Summaries";
    clearCacheButton.style.backgroundColor = "#f8f9fa";
    clearCacheButton.style.border = "1px solid #a2a9b1";
    clearCacheButton.style.borderRadius = "5px";
    clearCacheButton.style.padding = "5px";
    clearCacheButton.style.marginTop = "10px";
    clearCacheButton.style.width = "100%";
    clearCacheButton.style.cursor = "pointer";
    clearCacheButton.style.fontSize = "12px";
    
    clearCacheButton.addEventListener("click", () => {
        const keys = Object.keys(localStorage);
        const wikiSummaryKeys = keys.filter(key => key.startsWith('wiki-summary:'));
        wikiSummaryKeys.forEach(key => localStorage.removeItem(key));
        alert('Cache cleared!');
    });

    container.appendChild(summarizeButton);
    container.appendChild(clearCacheButton);
    document.body.appendChild(container);
})();
