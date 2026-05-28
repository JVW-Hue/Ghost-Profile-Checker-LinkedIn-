function calculateGhostScore(profileData) {
  let score = 0;
  let reasons = [];

  if (profileData.lastActivityDays !== null && profileData.lastActivityDays !== undefined) {
    if (profileData.lastActivityDays > 90) {
      score += 50;
      reasons.push(`Severe inactivity: ${profileData.lastActivityDays} days ago`);
    } else if (profileData.lastActivityDays > 30) {
      score += 25;
      reasons.push(`Last activity: ${profileData.lastActivityDays} days ago`);
    }
  }

  if (profileData.totalEngagements !== null && profileData.totalEngagements !== undefined) {
    if (profileData.totalEngagements < 5) {
      score += 20;
      reasons.push(`Very low recent engagement (${profileData.totalEngagements} interactions)`);
    } else if (profileData.totalEngagements < 20) {
      score += 10;
      reasons.push(`Low recent engagement (${profileData.totalEngagements} interactions)`);
    }
  }

  if (profileData.hasNoPhoto) {
    score += 15;
    reasons.push("No profile photo");
  }

  if (profileData.hasSparseExperience) {
    score += 15;
    reasons.push("Sparse experience section");
  }

  const isGhost = score >= 30;

  return { score, reasons, isGhost };
}

function extractProfileData() {
  const nameElement = document.querySelector('h1');
  const profileName = nameElement ? nameElement.innerText.trim() : null;

  const aboutElement = document.querySelector('#about') || document.querySelector('.pv-about__summary-text');
  const aboutText = aboutElement ? aboutElement.innerText.trim() : null;

  const photoElement = document.querySelector('.pv-top-card-profile-picture__image, .profile-photo-edit__preview');
  const hasNoPhoto = !photoElement;

  const experienceItems = document.querySelectorAll('#experience ~ div li, .pv-profile-section.pv-experience-section li');
  const hasSparseExperience = experienceItems.length < 2;

  const activityTextEl = document.querySelector('.profile-activity__list-heading, .pv-recent-activity-section__card');
  let lastActivityDays = null;
  if (activityTextEl) {
    const text = activityTextEl.innerText;
    const dayMatch = text.match(/(\d+)\s*d/i);
    if (dayMatch) lastActivityDays = parseInt(dayMatch[1], 10);
    const monthMatch = text.match(/(\d+)\s*mo/i);
    if (monthMatch) lastActivityDays = parseInt(monthMatch[1], 10) * 30;
    const yearMatch = text.match(/(\d+)\s*y/i);
    if (yearMatch) lastActivityDays = parseInt(yearMatch[1], 10) * 365;
  }

  const postElements = document.querySelectorAll('.occludable-update, .feed-shared-update-v2, .profile-activity__list-item');
  const totalEngagements = postElements.length;

  return {
    name: profileName,
    about: aboutText,
    hasNoPhoto,
    hasSparseExperience,
    lastActivityDays,
    totalEngagements,
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getProfileData") {
    console.log("Ghost Profile Checker: Extracting profile data...");

    const profileData = extractProfileData();
    const analysis = calculateGhostScore(profileData);

    sendResponse({ success: true, data: profileData, analysis: analysis });
  }
  return true;
});
