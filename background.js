chrome.runtime.onInstalled.addListener(() => {
  console.log("Ghost Profile Checker installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openOptions") {
    chrome.runtime.openOptionsPage();
  }
});
