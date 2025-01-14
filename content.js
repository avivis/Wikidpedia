function extractOverviewText() {
    console.log("Attempting to query overview section...");
    const overview = document.querySelector("#mw-content-text > div.mw-parser-output > p");
    if (overview) {
      console.log("Overview text found:", overview.innerText.trim());
      return overview.innerText.trim();
    } else {
      console.error("No overview text found on the page.");
      return null;
    }
  }
  
