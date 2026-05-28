const LICENSE_SERVER = 'https://ghost-profile-checker-linkedin.onrender.com';
const PAYMENT_PAGE_URL = LICENSE_SERVER + '/payment.html';
const LICENSE_STORAGE_KEY = 'ghost_premium_license';

let isPremium = false;

async function validateLicenseOnServer(key) {
  try {
    const res = await fetch(LICENSE_SERVER + '/api/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loadingIndicator');
  const freeResult = document.getElementById('freeResult');
  const premiumResult = document.getElementById('premiumResult');
  const scoreEl = document.getElementById('scoreValue');
  const statusEl = document.getElementById('statusBadge');
  const reasonsEl = document.getElementById('reasonsList');
  const refreshBtn = document.getElementById('refreshBtn');
  const premiumBadge = document.getElementById('premiumBadge');
  const exportSection = document.getElementById('exportSection');
  const exportBtn = document.getElementById('exportBtn');
  const licenseInput = document.getElementById('licenseKeyInput');
  const activateBtn = document.getElementById('activateBtn');
  const deactivateBtn = document.getElementById('deactivateBtn');
  const getPremiumBtn = document.getElementById('getPremiumBtn');
  const licenseInputGroup = document.getElementById('licenseInputGroup');
  const licenseThanks = document.getElementById('licenseThanks');
  const licenseStatus = document.getElementById('licenseStatus');
  const supportLink = document.getElementById('supportLink');

  function setFreeUI() {
    isPremium = false;
    premiumBadge.style.display = 'none';
    licenseInputGroup.style.display = 'flex';
    licenseThanks.style.display = 'none';
    getPremiumBtn.style.display = 'block';
    licenseStatus.textContent = '';
    premiumResult.style.display = 'none';
  }

  function setPremiumUI() {
    isPremium = true;
    premiumBadge.style.display = 'inline-block';
    licenseInputGroup.style.display = 'none';
    licenseThanks.style.display = 'flex';
    getPremiumBtn.style.display = 'none';
    licenseStatus.textContent = '';
  }

  function setLicenseError(msg) {
    licenseStatus.textContent = msg;
    licenseStatus.style.color = '#dc2626';
  }

  function setLicenseSuccess(msg) {
    licenseStatus.textContent = msg;
    licenseStatus.style.color = '#059669';
  }

  const stored = await chrome.storage.sync.get([LICENSE_STORAGE_KEY]);
  if (stored[LICENSE_STORAGE_KEY]) {
    isPremium = await validateLicenseOnServer(stored[LICENSE_STORAGE_KEY]);
    if (isPremium) setPremiumUI();
    else setFreeUI();
  } else {
    setFreeUI();
  }

  activateBtn.addEventListener('click', async () => {
    const key = licenseInput.value.trim();
    if (!key) {
      setLicenseError('Please enter a license key');
      return;
    }
    const valid = await validateLicenseOnServer(key);
    if (valid) {
      chrome.storage.sync.set({ [LICENSE_STORAGE_KEY]: key });
      setPremiumUI();
      setLicenseSuccess('License active');
    } else {
      chrome.storage.sync.remove([LICENSE_STORAGE_KEY]);
      setFreeUI();
      setLicenseError('Invalid license key');
    }
  });

  deactivateBtn.addEventListener('click', () => {
    chrome.storage.sync.remove([LICENSE_STORAGE_KEY]);
    isPremium = false;
    setFreeUI();
    setLicenseSuccess('License deactivated');
  });

  getPremiumBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: PAYMENT_PAGE_URL });
  });

  supportLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://mail.google.com/mail/?view=cm&fs=1&to=JVWcompany115@gmail.com' });
  });

  function calculateGhostScore(profileData) {
    let score = 0;
    let reasons = [];
    let greenFlags = [];

    if (profileData.lastActivityDays !== null && profileData.lastActivityDays !== undefined) {
      if (profileData.lastActivityDays > 365) {
        score += 50;
        reasons.push('No activity for over a year');
      } else if (profileData.lastActivityDays > 180) {
        score += 30;
        reasons.push(`No activity for ${profileData.lastActivityDays} days`);
      } else if (profileData.lastActivityDays > 90) {
        score += 15;
        reasons.push(`Last activity ${profileData.lastActivityDays} days ago`);
      }
    }

    if (profileData.totalEngagements !== null && profileData.totalEngagements !== undefined) {
      if (profileData.totalEngagements === 0) {
        score += 25;
        reasons.push('No recent activity posts found');
      } else if (profileData.totalEngagements < 3) {
        score += 10;
        reasons.push(`Very few activity items (${profileData.totalEngagements})`);
      } else if (profileData.totalEngagements >= 10) {
        greenFlags.push(`${profileData.totalEngagements} activity posts`);
        score = Math.max(0, score - 10);
      }
    }

    if (profileData.followers > 1000) {
      greenFlags.push(`${profileData.followers} followers (influential)`);
      score = Math.max(0, score - 20);
    } else if (profileData.followers > 500) {
      greenFlags.push(`${profileData.followers} followers`);
      score = Math.max(0, score - 10);
    } else if (profileData.followers > 100) {
      greenFlags.push(`${profileData.followers} followers`);
      score = Math.max(0, score - 5);
    }

    if (profileData.hasNoPhoto) {
      score += 20;
      reasons.push('No profile photo');
    } else {
      greenFlags.push('Has profile photo');
    }

    if (profileData.hasSparseExperience) {
      score += 20;
      reasons.push('No experience section found');
    }

    if (profileData.missingSections && profileData.missingSections.length > 0) {
      profileData.missingSections.forEach(section => {
        score += 5;
        reasons.push(`Missing: ${section}`);
      });
    }

    if (profileData.openToWork) {
      greenFlags.push('Open to work');
    }

    if (profileData.hasRecentViews) {
      greenFlags.push('Recent profile views');
      score = Math.max(0, score - 5);
    }

    if (profileData.postImpressions > 100) {
      greenFlags.push(`${profileData.postImpressions} post impressions`);
      score = Math.max(0, score - 10);
    } else if (profileData.postImpressions > 0) {
      greenFlags.push(`${profileData.postImpressions} post impressions`);
      score = Math.max(0, score - 5);
    }

    if (profileData.headline && profileData.headline.length > 20) {
      greenFlags.push('Has professional headline');
    }

    if (profileData.location) {
      greenFlags.push(`Location: ${profileData.location}`);
    }

    const isGhost = score >= 30;
    return { score, reasons, greenFlags, isGhost, profileData };
  }

  function extractProfileData() {
    const title = document.title;
    const profileName = title ? title.replace(/\s*\|\s*LinkedIn$/, '').trim() : null;
    const photoEl = document.querySelector('img[src*="profile-displayphoto"]');
    const hasNoPhoto = !photoEl;
    const sections = document.querySelectorAll('section');
    let activityLiCount = 0;
    let hasRecentViews = false;
    let lastActivityDays = null;
    let followers = 0;
    let postImpressions = 0;
    let foundSectionHeadings = [];
    let hasExperience = false;
    let openToWork = false;
    let headline = null;
    let location = null;

    sections.forEach(s => {
      const h2 = s.querySelector('h2');
      const heading = h2 ? h2.innerText.toLowerCase() : '';
      if (heading) foundSectionHeadings.push(heading);
      if (heading.includes('activity')) {
        const lis = s.querySelectorAll('li');
        activityLiCount = lis.length;
        const text = s.innerText;
        const dayMatch = text.match(/(\d+)\s+days?\s+ago/i);
        if (dayMatch) lastActivityDays = parseInt(dayMatch[1], 10);
        const monthMatch = text.match(/(\d+)\s+months?\s+ago/i);
        if (monthMatch) lastActivityDays = parseInt(monthMatch[1], 10) * 30;
        const yearMatch = text.match(/(\d+)\s+years?\s+ago/i);
        if (yearMatch) lastActivityDays = parseInt(yearMatch[1], 10) * 365;
        const followerMatch = text.match(/(\d[\d,]*)\s*followers?/i);
        if (followerMatch) followers = parseInt(followerMatch[1].replace(/,/g, ''), 10);
      }
      if (heading.includes('analytics')) {
        const text = s.innerText;
        if (text.match(/profile\s*views/i)) hasRecentViews = true;
        const impressionMatch = text.match(/(\d[\d,]*)\s*post\s*impressions?/i);
        if (impressionMatch) postImpressions = parseInt(impressionMatch[1].replace(/,/g, ''), 10);
      }
      if (heading.includes('experience')) hasExperience = true;
    });

    const primary = document.querySelector('[aria-label="Primary content"]');
    if (primary) {
      const text = primary.innerText;
      const openMatch = text.match(/Open\s+to\s+work/i);
      if (openMatch) openToWork = true;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        headline = lines[1];
        if (headline === profileName) headline = lines[2] || null;
      }
      const locationMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:\||·)(?:\s*Hybrid|\s*Remote|\s*On-site)/i);
      if (locationMatch) location = locationMatch[1].trim();
    }
    if (!location) {
      const locMatch = document.body.innerText.match(/Location/i);
      if (locMatch) {
        const around = document.body.innerText.slice(locMatch.index, locMatch.index + 100);
        const parts = around.split('\n').filter(Boolean);
        if (parts.length > 1) location = parts[1].trim();
      }
    }
    if (!followers) {
      const flwMatch = document.body.innerText.match(/(\d[\d,]*)\s*followers?/i);
      if (flwMatch) followers = parseInt(flwMatch[1].replace(/,/g, ''), 10);
    }
    if (!hasRecentViews && document.body.innerText.match(/profile\s*views/i)) hasRecentViews = true;

    const expectedSections = ['about', 'experience', 'education', 'skills'];
    const missingSections = expectedSections.filter(s => !foundSectionHeadings.some(h => h.includes(s)));
    const hasSparseExperience = !hasExperience;
    const totalEngagements = activityLiCount || null;

    return {
      name: profileName, headline, location, hasNoPhoto, hasSparseExperience,
      missingSections, lastActivityDays, totalEngagements, hasRecentViews,
      followers, postImpressions, openToWork,
    };
  }

  function analyzeProfile() {
    loadingEl.style.display = 'block';
    loadingEl.innerText = 'Analyzing profile...';
    freeResult.style.display = 'none';
    premiumResult.style.display = 'none';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) {
        loadingEl.innerText = 'Error: No active tab found.';
        return;
      }
      if (!activeTab.url || !activeTab.url.includes('linkedin.com/in/')) {
        loadingEl.innerText = 'Navigate to a LinkedIn profile page (linkedin.com/in/*).';
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: extractProfileData,
      }, (results) => {
        if (chrome.runtime.lastError) {
          loadingEl.innerText = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
        if (!results || !results[0] || !results[0].result) {
          loadingEl.innerText = 'Error: Could not extract profile data.';
          return;
        }

        const profileData = results[0].result;
        if (profileData.name) {
          document.getElementById('profileName').innerText = profileData.name;
          document.getElementById('profileInfo').style.display = 'block';
        }
        if (profileData.headline) {
          document.getElementById('profileHeadline').innerText = profileData.headline;
        }
        const metaParts = [];
        if (profileData.location) metaParts.push(profileData.location);
        if (profileData.followers) metaParts.push(`${profileData.followers} followers`);
        if (profileData.openToWork) metaParts.push('Open to work');
        if (metaParts.length) {
          document.getElementById('profileMeta').innerText = metaParts.join(' · ');
        }

        if (isPremium) {
          const analysis = calculateGhostScore(profileData);
          scoreEl.innerText = `${analysis.score}/100`;
          let riskClass = 'low-risk';
          let statusText = 'Active User';
          let badgeClass = 'badge active';
          if (analysis.isGhost) {
            riskClass = 'high-risk';
            statusText = 'Ghost Account Detected';
            badgeClass = 'badge ghost';
          } else if (analysis.score >= 15) {
            riskClass = 'medium-risk';
            statusText = 'Some Concerns';
            badgeClass = 'badge medium';
          }
          scoreEl.className = `score ${riskClass}`;
          statusEl.innerText = statusText;
          statusEl.className = badgeClass;

          reasonsEl.innerHTML = '';
          const allFlags = [...analysis.reasons, ...analysis.greenFlags.map(f => '+' + f)];
          if (allFlags.length === 0) {
            const li = document.createElement('li');
            li.innerText = 'No red flags detected. Clean profile.';
            reasonsEl.appendChild(li);
          } else {
            allFlags.forEach(reason => {
              const li = document.createElement('li');
              li.innerText = reason;
              if (reason.startsWith('+')) li.style.borderLeftColor = '#4ade80';
              reasonsEl.appendChild(li);
            });
          }
          loadingEl.style.display = 'none';
          premiumResult.style.display = 'block';
        } else {
          freeResult.querySelector('.free-info').innerHTML =
            `<p>Profile detected: <strong>${profileData.name || 'Unknown'}</strong></p>` +
            `<p>Followers: <strong>${profileData.followers || 'N/A'}</strong></p>` +
            `<div class="upgrade-prompt">` +
            `<p>Upgrade to <strong>Premium ($2.99/month)</strong> for full analysis including ghost score, activity check, engagement metrics, and more.</p>` +
            `<button id="inlineUpgradeBtn" class="btn-premium">Get Premium</button></div>`;
          loadingEl.style.display = 'none';
          freeResult.style.display = 'block';
          const inlineBtn = document.getElementById('inlineUpgradeBtn');
          if (inlineBtn) {
            inlineBtn.addEventListener('click', () => chrome.tabs.create({ url: PAYMENT_PAGE_URL }));
          }
        }
      });
    });
  }

  exportBtn.addEventListener('click', () => {
    const pName = document.getElementById('profileName').innerText;
    const score = document.getElementById('scoreValue').innerText;
    const status = document.getElementById('statusBadge').innerText;
    const reasons = document.querySelectorAll('#reasonsList li');
    let report = `Ghost Profile Checker Report\n==========================\n\nProfile: ${pName}\nScore: ${score}\nStatus: ${status}\n\nDetails:\n`;
    reasons.forEach(r => { report += `  - ${r.innerText}\n`; });
    report += `\nGenerated: ${new Date().toLocaleString()}\nPowered by Ghost Profile Checker\n`;
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghost-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  refreshBtn.addEventListener('click', analyzeProfile);
  window.onload = analyzeProfile;
});
