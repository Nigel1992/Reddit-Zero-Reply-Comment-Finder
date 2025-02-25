console.log('Background script loaded!');

// Create alarm for periodic fetching
chrome.alarms.create('fetchPosts', {
    periodInMinutes: 1 // Default to 1 minute
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'fetchPosts') {
        console.log('Alarm triggered fetch:', new Date().toLocaleTimeString());
        fetchNewPosts();
    }
});

// Initialize
console.log('Initializing background script:', new Date().toLocaleTimeString());
fetchNewPosts();

// Fetch stored user settings
async function getUserSettings() {
    const data = await chrome.storage.local.get(["client_id", "client_secret", "username", "password", "subredditLinks"]);
    return {
        clientId: data.client_id || "",
        clientSecret: data.client_secret || "",
        username: data.username || "",
        password: data.password || "",
        subredditUrls: data.subredditLinks || []
    };
}

let lastPostIds = new Set();
let lastFetchTime = 0;

async function fetchAccessToken() {
    try {
        console.log('Fetching access token...');
        const settings = await chrome.storage.local.get([
            'client_id',
            'client_secret',
            'username',
            'password',
            'access_token',
            'token_expiry'
        ]);

        // Check if we have a valid token
        if (settings.access_token && settings.token_expiry && Date.now() < settings.token_expiry) {
            console.log('Using existing token');
            return settings.access_token;
        }

        if (!settings.client_id || !settings.client_secret || !settings.username || !settings.password) {
            console.log('Missing credentials');
            return null;
        }

        const response = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(`${settings.client_id}:${settings.client_secret}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'RedditTracker/1.0'
            },
            body: `grant_type=password&username=${encodeURIComponent(settings.username)}&password=${encodeURIComponent(settings.password)}`
        });

        if (!response.ok) {
            console.error('Token fetch error:', response.status);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return null;
        }

        const data = await response.json();
        console.log('New token obtained');
        
        // Save new token
        await chrome.storage.local.set({
            access_token: data.access_token,
            token_expiry: Date.now() + (data.expires_in * 1000)
        });

        return data.access_token;
    } catch (error) {
        console.error('Token fetch error:', error);
        return null;
    }
}

// Create notification types
chrome.notifications.create('', {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'Reddit Zero Comments Tracker',
    message: 'Extension is running'
});

// Add this function to check storage
async function checkStorage() {
    console.log('Checking storage contents...');
    const storage = await chrome.storage.local.get(null);
    console.log('All storage:', storage);
    console.log('Stored posts:', storage.zeroPosts || []);
}

async function fetchNewPosts() {
    try {
        await checkStorage();
        console.log('Starting fetchNewPosts...', new Date().toLocaleTimeString());
        
        const settings = await chrome.storage.local.get(['checkFrequency', 'subredditLinks']);
        if (!settings.subredditLinks || settings.subredditLinks.length === 0) {
            console.log('No subreddits configured');
            return;
        }

        const accessToken = await fetchAccessToken();
        if (!accessToken) {
            console.error('No access token available');
            return;
        }

        // Get existing posts first
        const storage = await chrome.storage.local.get('zeroPosts');
        const existingPosts = storage.zeroPosts || [];
        const existingIds = new Set(existingPosts.map(post => post.id));
        
        console.log('Existing post IDs:', Array.from(existingIds));

        const newPosts = [];
        const currentPostIds = new Set();

        for (const subredditUrl of settings.subredditLinks) {
            try {
                const subredditName = subredditUrl.split('/r/')[1].split('/')[0];
                console.log(`Checking r/${subredditName}...`);

                const response = await fetch(
                    `https://oauth.reddit.com/r/${subredditName}/new.json?limit=100&sort=new`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'User-Agent': 'RedditTracker/1.0'
                        }
                    }
                );

                if (!response.ok) {
                    console.error(`Error fetching r/${subredditName}:`, response.status);
                    continue;
                }

                const data = await response.json();
                console.log(`Total posts fetched from r/${subredditName}:`, data.data.children.length);
                
                const zeroPosts = data.data.children
                    .map(child => child.data)
                    .filter(post => post.num_comments === 0);

                console.log(`Found ${zeroPosts.length} posts with 0 comments in r/${subredditName}`);
                
                // Process new posts with triple duplicate check
                for (const post of zeroPosts) {
                    // Skip if we've seen this post before in any way
                    if (existingIds.has(post.id) || 
                        currentPostIds.has(post.id) || 
                        lastPostIds.has(post.id)) {
                        console.log(`Skipping duplicate post: ${post.title}`);
                        continue;
                    }

                    console.log('New zero-comment post:', {
                        title: post.title,
                        subreddit: post.subreddit,
                        id: post.id,
                        created: new Date(post.created_utc * 1000).toLocaleString()
                    });

                    currentPostIds.add(post.id);
                    newPosts.push(post);
                }
            } catch (error) {
                console.error(`Error processing r/${subredditName}:`, error);
            }
        }

        console.log(`Total new posts found: ${newPosts.length}`);

        // Update storage with new posts
        if (newPosts.length > 0) {
            // Combine with existing posts, newest first
            const allPosts = [...newPosts, ...existingPosts]
                .sort((a, b) => b.created_utc - a.created_utc)
                .slice(0, 100); // Keep most recent 100 posts

            console.log('Storing posts:', allPosts.length);
            await chrome.storage.local.set({ 'zeroPosts': allPosts });
            
            // Update badge and notification
            chrome.action.setBadgeText({ text: newPosts.length.toString() });
            chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });

            const soundSettings = await chrome.storage.local.get(['soundEnabled']);
            chrome.notifications.create('new-posts', {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: 'New Posts Found',
                message: `Found ${newPosts.length} new posts with zero comments`,
                priority: 2,
                silent: !soundSettings.soundEnabled
            });
        }

        // Update tracking
        lastPostIds = currentPostIds;
        lastFetchTime = Date.now();

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);
    
    if (message.action === "fetchNewPosts") {
        console.log('Manual fetch triggered');
        fetchNewPosts();
    }
    return false;
});

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated:', new Date().toLocaleTimeString());
    fetchNewPosts();
});

// Listen for startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Browser started:', new Date().toLocaleTimeString());
    fetchNewPosts();
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.checkFrequency) {
        console.log('Check frequency changed, updating interval');
        fetchNewPosts();
    }
    if (namespace === 'local' && changes.zeroPosts) {
        console.log('Posts storage changed:', {
            oldValue: changes.zeroPosts.oldValue?.length || 0,
            newValue: changes.zeroPosts.newValue?.length || 0
        });
    }
});

// Reset counter when the popup closes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received:", message);
    if (message === "popup_closed") {
        console.log("Resetting counter");
        chrome.action.setBadgeText({ text: "" });
        // Don't clear allPosts anymore
    }
    return false;
});

// Add message listener for frequency updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateCheckFrequency") {
        (async () => {
            try {
                console.log("Updating check frequency to:", message.frequency);
                
                // Clear existing alarm
                await chrome.alarms.clear("fetchPosts");
                
                // Create new alarm with updated frequency
                await chrome.alarms.create("fetchPosts", {
                    periodInMinutes: message.frequency
                });
                
                // Verify alarm was created
                const alarms = await chrome.alarms.getAll();
                const fetchPostsAlarm = alarms.find(a => a.name === "fetchPosts");
                console.log("Updated alarm:", fetchPostsAlarm);
                
                // Fetch posts immediately with new frequency
                await fetchNewPosts();
                
                // Send success response
                sendResponse({ success: true });
            } catch (error) {
                console.error("Error updating check frequency:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep message channel open for async response
    }
    return false;
});

// Add to existing message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "testCredentials") {
        (async () => {
            try {
                const { clientId, clientSecret, username, password } = message.credentials;
                console.log("Testing credentials...");
                
                const response = await fetch("https://www.reddit.com/api/v1/access_token", {
                    method: "POST",
                    headers: {
                        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "RedditTracker/1.0"
                    },
                    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
                });

                const data = await response.json();
                console.log("API Response:", data);
                
                if (!response.ok) {
                    console.error("API Error:", data);
                    sendResponse({ 
                        success: false, 
                        error: data.message || `Invalid credentials (${response.status})`
                    });
                    return;
                }

                if (data.access_token) {
                    console.log("Got access token");
                    // Store the token for immediate use
                    await chrome.storage.local.set({ 
                        access_token: data.access_token,
                        token_expiry: Date.now() + (data.expires_in * 1000)
                    });
                    
                    sendResponse({ success: true });
                } else {
                    console.error("No access token in response");
                    sendResponse({ 
                        success: false, 
                        error: "No access token received" 
                    });
                }
            } catch (error) {
                console.error("Credential test error:", error);
                sendResponse({ 
                    success: false, 
                    error: "Connection error: " + error.message
                });
            }
        })();
        return true; // Keep the message channel open
    }
    if (message.action === "showStatus") {
        // This will be handled by the options page
        return false;
    }
    // ... other message handlers ...
});

// Add to options.js message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showStatus") {
        const statusMessage = document.getElementById("statusMessage");
        statusMessage.textContent = message.status;
        statusMessage.className = message.status.includes("❌") ? "error" : "success";
    }
});

// Add notification click handler
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'new-posts') {
        // Open the extension popup
        chrome.action.openPopup();
    }
});
